import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    Pressable,
    FlatList,
    Modal,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../utils/hooks/supabase";
// NOTE: requires `expo-image-picker` — if not installed yet:
//   npx expo install expo-image-picker
import * as ImagePicker from "expo-image-picker";
// NOTE: requires `expo-file-system` and `base64-arraybuffer` — same pattern
// used for story/media uploads on the event details screen
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

// same bucket the event details screen uploads media into — this just
// adds a new folder inside it for chat images
const STORAGE_BUCKET = "event-media";
const CHAT_MEDIA_FOLDER = "chat-media";

const SELF_ACCENT = "#FD2646"; // pink/red — "Me"
const OTHER_ACCENT = "#0AB6FF"; // blue — everyone else

// groups messages under a day label ("TODAY", "TUESDAY", etc.) the way
// Snapchat's chat screen does, instead of a timestamp on every message
function dayLabel(dateString) {
    const date = new Date(dateString);
    const now = new Date();

    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) return "TODAY";

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isYesterday) return "YESTERDAY";

    return date.toLocaleDateString([], { weekday: "long" }).toUpperCase();
}

export default function EventChatScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const event = route?.params?.event;

    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserName, setCurrentUserName] = useState("Me");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [draft, setDraft] = useState("");
    const [isSending, setIsSending] = useState(false);

    // latest story for this event — rendered as the "Tap to view" card
    const [latestStory, setLatestStory] = useState(null);
    const [storyViewerVisible, setStoryViewerVisible] = useState(false);

    // host's profile — used for the circular avatar in the header, since
    // events don't actually have an image_url column
    const [hostProfile, setHostProfile] = useState(null);

    const listRef = useRef(null);

    // who's actually sending messages
    useEffect(() => {
        const fetchUser = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.error("Error fetching current user:", error);
                return;
            }
            const uid = data?.user?.id ?? null;
            setCurrentUserId(uid);

            if (uid) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("userName")
                    .eq("id", uid)
                    .single();
                if (profile?.userName) setCurrentUserName(profile.userName);
            }
        };
        fetchUser();
    }, []);

    const fetchMessages = async () => {
        if (!event?.id) return;

        setIsLoading(true);

        const { data, error } = await supabase
            .from("event_chat_messages")
            .select(
                "id, event, user_id, body, media_url, created_at, profiles:user_id(userName, avatar)"
            )
            .eq("event", Number(event.id))
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching chat messages:", error);
            setMessages([]);
        } else {
            setMessages(data ?? []);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        fetchMessages();
    }, [event?.id]);

    // latest event story — shown as the tap-to-view card at the top of chat
    const fetchLatestStory = async () => {
        if (!event?.id) return;

        const { data, error } = await supabase
            .from("event_media")
            .select("id, media, media_type, date_added, profiles:posted_by(userName, avatar)")
            .eq("event", Number(event.id))
            .eq("media_type", "story")
            .order("date_added", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Error fetching latest story for chat:", error);
            return;
        }

        setLatestStory(data ?? null);
    };

    useEffect(() => {
        fetchLatestStory();
    }, [event?.id]);

    // host's avatar for the header circle
    useEffect(() => {
        const fetchHostProfile = async () => {
            if (!event?.host) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("userName, avatar")
                .eq("id", event.host)
                .single();

            if (error) {
                console.error("Error fetching host profile for chat header:", error);
                return;
            }

            setHostProfile(data);
        };

        fetchHostProfile();
    }, [event?.host]);

    // live updates — new messages from anyone (including other devices)
    // show up without needing to pull-to-refresh
    useEffect(() => {
        if (!event?.id) return;

        const channel = supabase
            .channel(`event-chat-${event.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "event_chat_messages",
                    filter: `event=eq.${event.id}`,
                },
                () => {
                    // simplest correct approach: refetch on any insert rather
                    // than trying to patch the new row's profile join in
                    // manually from the realtime payload alone
                    fetchMessages();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [event?.id]);

    const handleSend = async () => {
        const body = draft.trim();
        if (!body || !currentUserId || !event?.id || isSending) return;

        setIsSending(true);
        setDraft(""); // clear right away, feels more responsive

        const { error } = await supabase.from("event_chat_messages").insert({
            event: Number(event.id),
            user_id: currentUserId,
            body,
        });

        if (error) {
            console.error("Error sending message:", error);
            setDraft(body); // put it back so they don't lose what they typed
        }

        setIsSending(false);
    };

    // camera button — pick a photo from the library and send it as an
    // image message
    const handleSendImage = async () => {
        if (!currentUserId || !event?.id || isSending) return;

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            console.error("Media library permission not granted");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
        });

        if (result.canceled) return;

        setIsSending(true);

        try {
            const file = result.assets[0];
            const fileExt = file.uri.split(".").pop().toLowerCase();
            const filePath = `${CHAT_MEDIA_FOLDER}/${event.id}_${Date.now()}.${fileExt}`;

            const extToMimeType = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                heic: "image/heic",
                webp: "image/webp",
            };
            const contentType = extToMimeType[fileExt] ?? file.mimeType ?? "image/jpeg";

            // same base64 -> ArrayBuffer pattern used for story/media
            // uploads — fetch(uri).blob() is unreliable in RN/Expo
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, decode(base64), { contentType });

            if (uploadError) {
                console.error("Error uploading chat image:", uploadError);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);

            const { error: insertError } = await supabase
                .from("event_chat_messages")
                .insert({
                    event: Number(event.id),
                    user_id: currentUserId,
                    media_url: publicUrlData.publicUrl,
                });

            if (insertError) {
                console.error("Error saving chat image message:", insertError);
            }
        } catch (err) {
            console.error("Unexpected error sending chat image:", err);
        } finally {
            setIsSending(false);
        }
    };

    // build a flat list that includes day-divider rows interleaved with
    // the actual messages, same visual pattern as the reference screenshot
    const rowsWithDividers = messages.reduce((acc, message, index) => {
        const label = dayLabel(message.created_at);
        const prevLabel =
            index > 0 ? dayLabel(messages[index - 1].created_at) : null;

        if (label !== prevLabel) {
            acc.push({ type: "divider", id: `divider-${message.id}`, label });
        }

        acc.push({ type: "message", ...message });
        return acc;
    }, []);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={insets.top}
        >
            {/* Header — avatar + event title, matching the reference layout */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity
                    style={styles.headerBack}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.navigate("Postcard");
                        }
                    }}
                    hitSlop={8}
                >
                    <Ionicons name="chevron-back" size={28} color="#000000" />
                </TouchableOpacity>

                <Pressable
                    onPress={() => {
                        if (latestStory) setStoryViewerVisible(true);
                    }}
                >
                    <Image
                        source={{
                            uri:
                                latestStory?.media ||
                                hostProfile?.avatar ||
                                "https://api.dicebear.com/7.x/avataaars/svg?seed=" +
                                encodeURIComponent(event?.title ?? "event"),
                        }}
                        style={styles.headerAvatar}
                    />
                </Pressable>

                <Text style={styles.headerTitle} numberOfLines={1}>
                    {event?.title || "Event Chat"}
                </Text>
            </View>
            <View style={styles.headerDivider} />

            <FlatList
                ref={listRef}
                data={rowsWithDividers}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                    listRef.current?.scrollToEnd({ animated: true })
                }
                ListHeaderComponent={
                    latestStory ? (
                        <View style={styles.messageBlock}>
                            <Text style={[styles.senderName, { color: OTHER_ACCENT }]}>
                                {latestStory.profiles?.userName ?? "Someone"}
                            </Text>
                            <View style={styles.snapRow}>
                                <View
                                    style={[
                                        styles.accentBar,
                                        { backgroundColor: OTHER_ACCENT },
                                    ]}
                                />
                                <Pressable
                                    style={styles.snapCard}
                                    onPress={() => setStoryViewerVisible(true)}
                                >
                                    <View style={styles.snapIcon} />
                                    <Text style={styles.snapCardText}>Tap to view</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    if (item.type === "divider") {
                        return (
                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>{item.label}</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        );
                    }

                    const isSelf = item.user_id === currentUserId;
                    const accent = isSelf ? SELF_ACCENT : OTHER_ACCENT;
                    const name = isSelf
                        ? "Me"
                        : item.profiles?.userName ?? "Someone";

                    return (
                        <View style={styles.messageBlock}>
                            <Text style={[styles.senderName, { color: accent }]}>
                                {name}
                            </Text>
                            <View style={styles.messageRow}>
                                <View
                                    style={[styles.accentBar, { backgroundColor: accent }]}
                                />
                                {item.media_url ? (
                                    <Image
                                        source={{ uri: item.media_url }}
                                        style={styles.imageMessage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <Text style={styles.messageText}>{item.body}</Text>
                                )}
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        {isLoading
                            ? "Loading messages..."
                            : "No messages yet — say hi 👋"}
                    </Text>
                }
            />

            {/* Bottom bar — camera / pill input with mic / emoji / bitmoji / game,
                matching the reference layout */}
            <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
                <TouchableOpacity
                    style={styles.cameraButton}
                    onPress={handleSendImage}
                    disabled={isSending}
                >
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.inputPill}>
                    <TextInput
                        style={styles.input}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Send a chat"
                        placeholderTextColor="#8E8E93"
                        returnKeyType="send"
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity hitSlop={6}>
                        <Ionicons name="mic-outline" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.iconButton} hitSlop={6}>
                    <Ionicons name="happy-outline" size={24} color="#000000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} hitSlop={6}>
                    <Ionicons name="albums-outline" size={22} color="#000000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} hitSlop={6}>
                    <Ionicons name="game-controller-outline" size={22} color="#000000" />
                </TouchableOpacity>
            </View>

            {/* Full-screen viewer for the "Tap to view" story card */}
            <Modal
                visible={storyViewerVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setStoryViewerVisible(false)}
            >
                <Pressable
                    style={styles.storyViewerContainer}
                    onPress={() => setStoryViewerVisible(false)}
                >
                    {latestStory && (
                        <Image
                            source={{ uri: latestStory.media }}
                            style={styles.storyViewerImage}
                            resizeMode="contain"
                        />
                    )}
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 12,
        backgroundColor: "#FFFFFF",
    },
    headerBack: {
        padding: 4,
        marginRight: 4,
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#E5E5EA",
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: "#000000",
        flex: 1,
    },
    headerDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#D1D1D6",
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    emptyText: {
        textAlign: "center",
        color: "#8E8E93",
        marginTop: 40,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 14,
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#D1D1D6",
    },
    dividerText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#8E8E93",
        letterSpacing: 0.5,
        marginHorizontal: 10,
    },
    messageBlock: {
        marginBottom: 16,
        maxWidth: "85%",
    },
    senderName: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 4,
        marginLeft: 10,
    },
    messageRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    accentBar: {
        width: 3,
        borderRadius: 2,
        alignSelf: "stretch",
        marginRight: 10,
    },
    messageText: {
        fontSize: 16,
        color: "#000000",
        flexShrink: 1,
        paddingTop: 1,
    },
    imageMessage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        backgroundColor: "#E5E5EA",
    },
    snapRow: {
        flexDirection: "row",
        alignItems: "stretch",
    },
    snapCard: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#D1D1D6",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    snapIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: OTHER_ACCENT,
        marginRight: 12,
    },
    snapCardText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#000000",
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E5EA",
        backgroundColor: "#FFFFFF",
    },
    cameraButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    inputPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#D1D1D6",
        borderRadius: 20,
        paddingLeft: 16,
        paddingRight: 12,
        height: 40,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#000000",
    },
    iconButton: {
        paddingHorizontal: 6,
    },
    storyViewerContainer: {
        flex: 1,
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
    },
    storyViewerImage: {
        width: "100%",
        height: "100%",
    },
});