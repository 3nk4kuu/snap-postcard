import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    FlatList,
    Dimensions,
    Pressable,
} from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { supabase } from "../../utils/hooks/supabase";
import { getEventMedia } from "../../utils/eventMediaUtil";
import {
    formatEventDate,
    formatTime,
} from "../../utils/dateFormatUtil";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2; // 2 columns w/ padding


export default function PostCardEventScreen({ route, navigation }) {
    // Grab the event object passed from the hub screen
    const event = route?.params?.event;

    // Attendee count + RSVP state
    const [attendingCount, setAttendingCount] = useState(0);
    const [activeTab, setActiveTab] = useState("Stories");
    const [rsvpValue, setRsvpValue] = useState("");

    // Media grid state
    const [eventMedia, setEventMedia] = useState([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(true);

    // Avatar stack state - avatars of everyone invited to this event
    const [avatar, setAvatar] = useState([]);
    const [isLoadingAvatar, setIsLoadingAvatar] = useState(true);

    // get attending count for this event
    useEffect(() => {
        if (!event?.id) return;

        const fetchCount = async () => {
            const { count, error } = await supabase
                .from("invited")
                .select("*", { count: "exact", head: true })
                .eq("event", Number(event.id));

            if (error) {
                console.error("Error fetching attending count:", error);
                return;
            }

            setAttendingCount(count ?? 0);
        };

        fetchCount();
    }, [event?.id]);

    // get all media for this event (for the grid below)
    useEffect(() => {
        if (!event?.id) return;

        const fetchMedia = async () => {
            setIsLoadingMedia(true);

            const { data, error } = await supabase
                .from("event_media")
                .select("id, event, media, date_added")
                .eq("event", Number(event.id));

            // leaving these logs in for now, useful for debugging media loading
            console.log("Querying event:", Number(event.id));
            console.log("Fetched media:", data);
            console.log("Media error:", error);

            if (error) {
                console.error("Error fetching media:", error);
                setEventMedia([]);
            } else {
                console.log("Fetched media:", data);
                setEventMedia(data ?? []);
            }

            setIsLoadingMedia(false);
        };

        fetchMedia();
    }, [event?.id]);

    // get avatars for everyone invited to this event
    // (profiles doesn't have an "event" column — that link lives on
    // "invited", so we query invited and join into profiles for the avatar)
    useEffect(() => {
        if (!event?.id) return;

        const fetchAvatar = async () => {
            setIsLoadingAvatar(true);

            const { data, error } = await supabase
                .from("invited")
                .select("user, profiles(userName, avatar)")
                .eq("event", Number(event.id));

            if (error) {
                console.error("Error fetching invited avatars:", error);
                setAvatar([]);
            } else {
                // pull the joined profile out of each invited row
                const invitedProfiles = (data ?? [])
                    .map((row) => row.profiles)
                    .filter(Boolean);
                setAvatar(invitedProfiles);
            }

            setIsLoadingAvatar(false);
        };

        fetchAvatar();
    }, [event?.id]);


    // Header element containing top event details
    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Top event photo + title/date/attendee pill */}
            <View style={styles.eventInfoSection}>
                <Image
                    source={{
                        uri:
                            event.image_url ||
                            "https://s3.amazonaws.com/media.theteenmagazine.com/ckeditor_uploads/posts/6-unique-hangout-ideas-to-do-with-your-friends-that-won-t-break-the-bank/e54d8d59-17cb-420d-9965-48fa31ce1caa-2070.png",
                    }}
                    style={styles.image}
                />

                <View style={styles.eventDetails}>
                    <Text style={styles.title}>{event.title || "Untitled Event"}</Text>

                    {/* format date and time and put in pill */}
                    <View style={styles.datePill}>
                        <Text style={styles.dateText}>
                            {event.start_datetime
                                ? `${formatEventDate(event.start_datetime)} • ${formatTime(
                                    event.start_datetime
                                )}`
                                : "No date set"}
                        </Text>
                    </View>

                    {/* Avatars & extra attendees row - pulled live from invited/profiles now */}
                    <View style={styles.avatarRow}>
                        <View style={styles.avatarStack}>
                            {avatar.slice(0, 3).map((profile, index) => (
                                <Image
                                    key={profile.userName ?? index}
                                    source={{ uri: profile.avatar }}
                                    style={[
                                        styles.stackedAvatar,
                                        index > 0 && styles.overlappingAvatar,
                                    ]}
                                />
                            ))}
                        </View>

                        <View style={styles.badgePill}>
                            <Text style={styles.badgeText}>
                                + {attendingCount} attending
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Action Buttons Row - map + chat */}
            <View style={styles.actionsRow}>
                <Pressable
                    style={styles.actionPill}
                    onPress={() => navigation?.navigate?.("Map", { event })}
                >
                    <Text style={styles.actionText}>View on map</Text>
                </Pressable>

                <Pressable
                    style={styles.actionPill}
                    onPress={() => navigation?.navigate?.("Chat", { event })}
                >
                    <Text style={styles.actionText}>Open chat</Text>
                </Pressable>
            </View>

            {/* RSVP segmented buttons - yes/maybe/no */}
            <View style={styles.rsvpContainer}>
                <SegmentedButtons
                    value={rsvpValue}
                    onValueChange={setRsvpValue}
                    buttons={[
                        { value: "Yes", label: "Yes" },
                        { value: "Maybe", label: "Maybe" },
                        { value: "No", label: "No" },
                    ]}
                />
            </View>

            {/* Event Description */}
            {event.description ? (
                <Text style={styles.descriptionText}>{event.description}</Text>
            ) : null}

            <Text style={styles.host}>
                Hosted by: {event.host_profile?.userName || "Unknown host"}
            </Text>
            <Text style={styles.attending}>
                {attendingCount} {attendingCount === 1 ? "friend" : "friends"} attending
            </Text>

            {/* Tab Header bar - Stories vs All Media */}
            <View style={styles.tabContainer}>
                <Pressable
                    style={[
                        styles.tabButton,
                        activeTab === "Stories" && styles.activeTabButton,
                    ]}
                    onPress={() => setActiveTab("Stories")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "Stories" && styles.activeTabText,
                        ]}
                    >
                        Stories
                    </Text>
                </Pressable>

                <Pressable
                    style={[
                        styles.tabButton,
                        activeTab === "All Media" && styles.activeTabButton,
                    ]}
                    onPress={() => setActiveTab("All Media")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "All Media" && styles.activeTabText,
                        ]}
                    >
                        All Media
                    </Text>
                </Pressable>
            </View>
        </View>
    );

    const visibleData = eventMedia;

    // make the media grid
    return (
        <FlatList
            style={styles.container}
            data={eventMedia}
            numColumns={2}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
                <View style={styles.storyCard}>
                    <Image
                        source={{ uri: item.media }}
                        style={styles.storyImage}
                        resizeMode="cover"
                        onError={(error) => {
                            console.log(
                                "Image failed:",
                                item.media,
                                error.nativeEvent.error
                            );
                        }}
                    />
                </View>
            )}
            ListEmptyComponent={
                <Text style={styles.emptyText}>
                    {isLoadingMedia ? "Loading media..." : "No media yet."}
                </Text>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFF",
    },
    centeredContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
        padding: 24,
    },
    errorText: {
        fontSize: 16,
        color: "#575757",
        textAlign: "center",
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: "space-between",
    },
    headerContainer: {
        marginBottom: 16,
    },
    eventInfoSection: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    image: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 14,
    },
    eventDetails: {
        flex: 1,
        alignItems: "flex-start",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#000",
        marginBottom: 6,
    },
    datePill: {
        backgroundColor: "#F2F2F6",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    dateText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#6E6E73",
    },
    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarStack: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 8,
    },
    stackedAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "#FFF",
        backgroundColor: "#E5E5EA",
    },
    overlappingAvatar: {
        marginLeft: -8,
    },
    badgePill: {
        backgroundColor: "#F2F2F6",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#6E6E73",
    },
    actionsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 12,
    },
    actionPill: {
        flex: 1,
        backgroundColor: "#F2F2F6",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    actionText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    rsvpContainer: {
        marginBottom: 14,
    },
    descriptionText: {
        fontSize: 14,
        color: "#3A3A3C",
        lineHeight: 18,
        marginBottom: 10,
    },
    host: {
        fontSize: 16,
        color: "#575757",
        marginTop: 6,
    },
    attending: {
        fontSize: 14,
        color: "#FF3386",
        marginTop: 5,
        marginBottom: 20,
    },
    tabContainer: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E5EA",
        marginTop: 10,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
    },
    activeTabButton: {
        borderBottomWidth: 3,
        borderBottomColor: "#000",
    },
    tabText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#8E8E93",
    },
    activeTabText: {
        color: "#000",
        fontWeight: "bold",
    },
    storyCard: {
        width: CARD_WIDTH,
        height: 200,
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 12,
        backgroundColor: "#E5E5EA",
    },
    storyImage: {
        width: "100%",
        height: "100%",
    },
    storyOverlay: {
        position: "absolute",
        bottom: 8,
        left: 8,
        right: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    storyAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#FFF",
        marginRight: 6,
    },
    storyTextContainer: {
        flex: 1,
    },
    storyUser: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "600",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    storyCaption: {
        color: "#FFF",
        fontSize: 12,
        fontWeight: "bold",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    emptyText: {
        textAlign: "center",
        color: "#8E8E93",
        marginTop: 24,
    },
});