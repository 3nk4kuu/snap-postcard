import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../utils/hooks/supabase";

export default function EventChatScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const event = route?.params?.event;

    const [currentUserId, setCurrentUserId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [draft, setDraft] = useState("");
    const [isSending, setIsSending] = useState(false);

    const listRef = useRef(null);

    // who's actually sending messages
    useEffect(() => {
        const fetchUser = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.error("Error fetching current user:", error);
                return;
            }
            setCurrentUserId(data?.user?.id ?? null);
        };
        fetchUser();
    }, []);

    const fetchMessages = async () => {
        if (!event?.id) return;

        setIsLoading(true);

        const { data, error } = await supabase
            .from("event_chat_messages")
            .select("id, event, user_id, body, created_at, profiles:user_id(userName, avatar)")
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={insets.top}
        >
            {/* Custom header */}
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

                <Text style={styles.headerTitle} numberOfLines={1}>
                    {event?.title ? `${event.title} Chat` : "Event Chat"}
                </Text>
            </View>
            <View style={styles.headerDivider} />

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                    listRef.current?.scrollToEnd({ animated: true })
                }
                renderItem={({ item }) => {
                    const isSelf = item.user_id === currentUserId;

                    return (
                        <View
                            style={[
                                styles.messageRow,
                                isSelf && styles.messageRowSelf,
                            ]}
                        >
                            {!isSelf && (
                                <Image
                                    source={{ uri: item.profiles?.avatar }}
                                    style={styles.avatar}
                                />
                            )}

                            <View
                                style={[
                                    styles.bubble,
                                    isSelf ? styles.bubbleSelf : styles.bubbleOther,
                                ]}
                            >
                                {!isSelf && (
                                    <Text style={styles.author}>
                                        {item.profiles?.userName ?? "Someone"}
                                    </Text>
                                )}
                                <Text
                                    style={[
                                        styles.body,
                                        isSelf && styles.bodySelf,
                                    ]}
                                >
                                    {item.body}
                                </Text>
                                <Text
                                    style={[
                                        styles.time,
                                        isSelf && styles.timeSelf,
                                    ]}
                                >
                                    {new Date(item.created_at).toLocaleTimeString([], {
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </Text>
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

            <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
                <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Message"
                    placeholderTextColor="#8E8E93"
                    multiline
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        !draft.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!draft.trim() || isSending}
                >
                    <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FBFBF5",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 48,
        paddingBottom: 8,
        backgroundColor: "#FFFFFF",
    },
    headerBack: {
        position: "absolute",
        left: 12,
        bottom: 8,
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#000000",
    },
    headerDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "#D1D1D6",
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    emptyText: {
        textAlign: "center",
        color: "#8E8E93",
        marginTop: 40,
    },
    messageRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginBottom: 12,
        maxWidth: "85%",
    },
    messageRowSelf: {
        alignSelf: "flex-end",
        flexDirection: "row-reverse",
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 8,
        backgroundColor: "#E5E5EA",
    },
    bubble: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxWidth: "100%",
    },
    bubbleOther: {
        backgroundColor: "#F2F2F6",
        borderBottomLeftRadius: 4,
    },
    bubbleSelf: {
        backgroundColor: "#0FADFF",
        borderBottomRightRadius: 4,
    },
    author: {
        fontSize: 12,
        fontWeight: "700",
        color: "#575757",
        marginBottom: 2,
    },
    body: {
        fontSize: 15,
        color: "#000000",
    },
    bodySelf: {
        color: "#FFFFFF",
    },
    time: {
        fontSize: 10,
        color: "#8E8E93",
        marginTop: 4,
        alignSelf: "flex-end",
    },
    timeSelf: {
        color: "rgba(255,255,255,0.7)",
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E5EA",
        backgroundColor: "#FFFFFF",
    },
    input: {
        flex: 1,
        backgroundColor: "#F2F2F6",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: "#000000",
        maxHeight: 100,
        marginRight: 8,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#0FADFF",
        alignItems: "center",
        justifyContent: "center",
    },
    sendButtonDisabled: {
        backgroundColor: "#B0D9F5",
    },
});