import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Dimensions,
    Pressable,
    Modal,
} from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { supabase } from "../../utils/hooks/supabase";
import {
    formatEventDate,
    formatTime,
} from "../../utils/dateFormatUtil";
// same helper the create/edit screen uses, so timestamp columns get local
// wall-clock time instead of UTC
import { toLocalTimestamp } from "../../utils/eventDateUtil";
import { FAB } from "@rn-vui/themed";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// NOTE: requires `expo-image-picker` — if not installed yet:
//   npx expo install expo-image-picker
import * as ImagePicker from "expo-image-picker";
// NOTE: requires `expo-file-system` (usually already in Expo projects) and
// `base64-arraybuffer` — if not installed: npm install base64-arraybuffer
// on newer Expo SDKs (52+), the old readAsStringAsync/EncodingType API
// moved to this legacy subpath
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
// NOTE: requires `expo-media-library` — if not installed yet:
//   npx expo install expo-media-library
import * as MediaLibrary from "expo-media-library";

// make card grid
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2; // 2 columns w/ padding

// Actual Supabase Storage setup (confirmed from dashboard)
const STORAGE_BUCKET = "event-media";
const MEDIA_FOLDER = "uploaded-media";
const STORY_FOLDER = "stories";

// RSVP button colors by status — used both for the segmented buttons and for the status pills in the attendees sheet
const RSVP_COLORS = {
    yes: "#2ECC4E",   // green
    maybe: "#FFC400", // yellow
    no: "#FD2646",    // red
};

// how each stored status reads in the attendees list
const RSVP_LABELS = {
    yes: "Going",
    maybe: "Maybe",
    no: "Can't go",
};

// pill colors for an attendee's saved status — null/undefined means they haven't answered yet
function rsvpBadgeColors(status) {
    if (status === "yes") return { background: RSVP_COLORS.yes, text: "#FFFFFF" };
    if (status === "maybe") return { background: RSVP_COLORS.maybe, text: "#000000" };
    if (status === "no") return { background: RSVP_COLORS.no, text: "#FFFFFF" };
    return { background: "#E5E5EA", text: "#6E6E73" };
}


export default function PostCardEventScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();

    // Grab the event object passed from the hub screen
    const initialEvent = route?.params?.event;
    console.log(initialEvent)

    // Live copy of the event we're viewing — starts as whatever got passed
    // in via navigation, but gets refreshed from the DB after an edit saves.
    const [currentEvent, setCurrentEvent] = useState(initialEvent);
    const event = currentEvent; // keep the rest of the file's `event.` refs working

    // Attendee count + RSVP state
    const [attendingCount, setAttendingCount] = useState(0);
    const [activeTab, setActiveTab] = useState("Stories");
    const [rsvpValue, setRsvpValue] = useState("");
    const [isSavingRsvp, setIsSavingRsvp] = useState(false);

    // this user's role on this event ("host" / "guest"), kept so saving an RSVP never overwrites it
    const [myRole, setMyRole] = useState(null);

    // current logged-in user (needed so RSVP knows *whose* row to upsert,
    // and to check if they're the host for the Edit option)
    const [currentUserId, setCurrentUserId] = useState(null);

    // only the host should see "Edit event" in the FAB menu
    const isHost = Boolean(
        currentUserId && event?.host && currentUserId === event.host
    );

    // FAB action menu (Edit / Add to Story / Add to Media)
    const [menuOpen, setMenuOpen] = useState(false);

    // Story viewer modal (opens when tapping the event image)
    const [storyViewerVisible, setStoryViewerVisible] = useState(false);
    // which story is actually being shown in the viewer — set when tapping
    // either the header circle image or any story tile in the grid
    const [selectedStory, setSelectedStory] = useState(null);

    // media preview/save modal — opens when tapping a photo (non-story) tile
    const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [isSavingMedia, setIsSavingMedia] = useState(false);

    // Media grid state
    const [eventMedia, setEventMedia] = useState([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(true);

    // Avatar stack state - everyone invited to this event, with their RSVP
    const [avatar, setAvatar] = useState([]);
    // bottom sheet listing everyone invited — opens when tapping the
    // "+ X attending" badge
    const [attendeesVisible, setAttendeesVisible] = useState(false);
    const [isLoadingAvatar, setIsLoadingAvatar] = useState(true);

    //Host
    const [host, setHostName] = useState([]);

    // get the currently logged-in user's id
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

    // get the event row itself (title/description/start_datetime/location/host)
    const fetchEventDetails = async () => {
        if (!initialEvent?.id) return;

        const { data, error } = await supabase
            .from("events")
            .select("*")
            .eq("id", initialEvent.id)
            .single();

        if (error) {
            console.error("Error fetching event details:", error);
            return;
        }

        if (data) {
            setCurrentEvent(data);
        }
    };

    useEffect(() => {
        fetchEventDetails();
    }, [initialEvent?.id]);

    // get host for this event
    const fetchHost = async () => {
        if (!event?.host) return;

        const { data, error } = await supabase
            .from("profiles")
            .select("userName")
            .eq("id", event.host)
            .single();

        if (error) {
            console.error("Error fetching host profile:", error);
            return;
        }

        setHostName(data?.userName ?? "Unknown host");
    };

    useEffect(() => {
        fetchHost();
    }, [event?.host]);

    // get attending count for this event — only counts people who actually
    // said "yes", not everyone who was invited. (Previously this counted
    // every row in `invited` regardless of status, so switching your RSVP
    // to "no" never changed the number at all.)
    const fetchCount = async () => {
        if (!event?.id) return;

        const { count, error } = await supabase
            .from("invited")
            .select("*", { count: "exact", head: true })
            .eq("event", Number(event.id))
            .eq("status", "yes");

        if (error) {
            console.error("Error fetching attending count:", error);
            return;
        }

        setAttendingCount(count ?? 0);
    };

    useEffect(() => {
        fetchCount();
    }, [event?.id]);

    // get all media for this event (for the grid below). Ordered newest
    // first by date_added, with id as a tiebreaker in case two uploads land
    // on the exact same timestamp — without the tiebreaker, ties can come
    // back in an inconsistent order and the newest one might not actually
    // end up first.
    const fetchMedia = async () => {
        if (!event?.id) return;

        setIsLoadingMedia(true);

        const { data, error } = await supabase
            .from("event_media")
            .select("id, event, media, media_type, date_added, posted_by, profiles:posted_by(userName, avatar)")
            .eq("event", Number(event.id))
            .order("date_added", { ascending: false })
            .order("id", { ascending: false });

        if (error) {
            console.error("Error fetching media:", error);
            setEventMedia([]);
        } else {
            setEventMedia(data ?? []);
        }

        setIsLoadingMedia(false);
    };

    useEffect(() => {
        fetchMedia();
    }, [event?.id]);

    // get everyone invited to this event — status and role come along so the
    // attendees sheet can show each person's RSVP next to their name
    const fetchAvatar = async () => {
        if (!event?.id) return;

        setIsLoadingAvatar(true);

        const { data, error } = await supabase
            .from("invited")
            .select("user, status, role, profiles(userName, avatar)")
            .eq("event", Number(event.id));

        if (error) {
            console.error("Error fetching invited avatars:", error);
            setAvatar([]);
        } else {
            // flatten the joined profile up so the avatar stack and the attendees list can both read straight off each row
            const invitedProfiles = (data ?? [])
                .filter((row) => row.profiles)
                .map((row) => ({
                    user: row.user,
                    status: row.status,
                    role: row.role,
                    userName: row.profiles.userName,
                    avatar: row.profiles.avatar,
                }));
            setAvatar(invitedProfiles);
        }

        setIsLoadingAvatar(false);
    };

    useEffect(() => {
        fetchAvatar();
    }, [event?.id]);

    // get this user's existing RSVP for this event, so the segmented button shows their actual saved choice instead of resetting blank
    // role comes along too so saving an RSVP can preserve it.
    const fetchMyRsvp = async () => {
        if (!event?.id || !currentUserId) return;

        const { data, error } = await supabase
            .from("invited")
            .select("status, role")
            .eq("event", Number(event.id))
            .eq("user", currentUserId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching my RSVP:", error);
            return;
        }

        setRsvpValue(data?.status ?? "");
        setMyRole(data?.role ?? null);
    };

    useEffect(() => {
        fetchMyRsvp();
    }, [event?.id, currentUserId]);

    // called when the user taps Yes/Maybe/No — saves immediately
    // role is carried over from the existing row so a host RSVPing to their own event doesn't demote themselves to "guest"
    // only a brand new row falls back to "guest"
    const handleRsvpChange = async (newValue) => {
        setRsvpValue(newValue); // update UI right away
        if (!event?.id || !currentUserId) return;

        setIsSavingRsvp(true);

        const roleToKeep = myRole ?? "guest";

        const { error } = await supabase
            .from("invited")
            .upsert(
                {
                    event: Number(event.id),
                    user: currentUserId,
                    status: newValue,
                    role: roleToKeep,
                },
                { onConflict: "event,user" }
            );

        if (error) {
            console.error("Error saving RSVP:", error);
        } else {
            setMyRole(roleToKeep);
            fetchCount();  // attending count may have changed
            fetchAvatar(); // and so may this person's row in the list
        }

        setIsSavingRsvp(false);
    };

    // re-run all of this event's fetches — used after the edit screen saves
    const refreshEvents = async () => {
        await Promise.all([
            fetchEventDetails(),
            fetchHost(),
            fetchCount(),
            fetchMedia(),
            fetchAvatar(),
            fetchMyRsvp(),
        ]);
    };

    // shared upload flow for story/media, from either the library or the
    // device camera (photo or video). `source` is "library" | "camera",
    // `assetKind` is "image" | "video" (video only really makes sense with
    // the camera option, but the param stays generic in case that changes).
    const pickAndUpload = async (mediaType, source = "library", assetKind = "image") => {
        console.log("pickAndUpload called:", { mediaType, source, assetKind });
        setMenuOpen(false);

        let result;

        if (source === "camera") {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            console.log("Camera permission result:", permission);
            if (!permission.granted) {
                console.error("Camera permission not granted:", permission);
                return;
            }

            try {
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: assetKind === "video" ? ["videos"] : ["images"],
                    quality: 0.7,
                    videoMaxDuration: 15,
                });
            } catch (err) {
                console.error("launchCameraAsync threw:", err);
                return;
            }
        } else {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                console.error("Media library permission not granted");
                return;
            }

            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.7,
            });
        }

        if (result.canceled) return;

        const file = result.assets[0];
        const fileExt = file.uri.split(".").pop().toLowerCase();
        const folder = mediaType === "story" ? STORY_FOLDER : MEDIA_FOLDER;
        const filePath = `${folder}/${event.id}_${Date.now()}.${fileExt}`;

        // derive contentType from the actual extension rather than trusting
        // file.mimeType — that can come back undefined on some platforms,
        // and a mismatched Content-Type (e.g. saying jpeg for real png
        // bytes) makes iOS's image decoder fail with a generic download error
        const extToMimeType = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            heic: "image/heic",
            mp4: "video/mp4",
            mov: "video/quicktime",
        };
        const contentType = extToMimeType[fileExt] ?? file.mimeType ?? "image/jpeg";

        try {
            // fetch(uri).blob() is unreliable in RN/Expo — it can silently
            // produce a corrupted/empty blob, which is why the upload
            // "succeeds" but the resulting file won't actually load.
            // Reading as base64 and decoding to an ArrayBuffer is the
            // reliable pattern for Expo + Supabase Storage uploads.
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, decode(base64), {
                    contentType,
                });

            if (uploadError) {
                console.error("Error uploading file:", uploadError);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);

            // Save local wall-clock time because date_added is a plain
            // timestamp column without time zone in Supabase.
            const localDateAdded = toLocalTimestamp(new Date());

            const { error: insertError } = await supabase
                .from("event_media")
                .insert([
                    {
                        event: Number(event.id),
                        media: publicUrlData.publicUrl,
                        media_type: mediaType,
                        date_added: localDateAdded,
                        posted_by: currentUserId,
                    },
                ]);

            if (insertError) {
                console.error("Error saving media row:", insertError);
                return;
            }

            fetchMedia();
        } catch (err) {
            console.error("Unexpected upload error:", err);
        }
    };

    // most recently uploaded story, for the tap-to-view-story modal and
    // for the header's circular image
    const latestStory = eventMedia.find((item) => item.media_type === "story");

    function timeAgo(dateString) {
        if (!dateString) return "";

        const uploadedAt = new Date(dateString).getTime();
        const now = Date.now();

        if (Number.isNaN(uploadedAt)) {
            console.log("Invalid date_added:", dateString);
            return "";
        }

        const seconds = Math.max(0, Math.floor((now - uploadedAt) / 1000));

        if (seconds < 60) return "Just now";

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    // downloads a story/media URL and saves it to the device's photo
    // library. MediaLibrary.saveToLibraryAsync needs a local file URI, not
    // a remote https URL, so we download it to a temp path first.
    const saveMediaToDevice = async (remoteUrl) => {
        if (!remoteUrl || isSavingMedia) return;
        setIsSavingMedia(true);

        try {
            const permission = await MediaLibrary.requestPermissionsAsync();
            if (!permission.granted) {
                console.error("Media library save permission not granted");
                return;
            }

            const fileExt = remoteUrl.split(".").pop().split("?")[0];
            const localUri = `${FileSystem.cacheDirectory}saved_${Date.now()}.${fileExt}`;

            const { uri: downloadedUri } = await FileSystem.downloadAsync(
                remoteUrl,
                localUri
            );

            await MediaLibrary.saveToLibraryAsync(downloadedUri);
            console.log("Saved to device photo library:", downloadedUri);
        } catch (err) {
            console.error("Error saving media to device:", err);
        } finally {
            setIsSavingMedia(false);
        }
    };

    // Only confirmed attendees appear in the compact avatar stack.
    // Keep the full avatar array for the attendees sheet.
    const goingAvatars = avatar.filter((profile) => profile.status === "yes");

    // Header element containing top event details
    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Top event photo + title/date/attendee pill */}
            <View style={styles.eventInfoSection}>
                <Pressable
                    onPress={() => {
                        setSelectedStory(latestStory);
                        setStoryViewerVisible(true);
                    }}
                >
                    <Image
                        source={{
                            uri:
                                latestStory?.media ||
                                event.image_url ||
                                "https://s3.amazonaws.com/media.theteenmagazine.com/ckeditor_uploads/posts/6-unique-hangout-ideas-to-do-with-your-friends-that-won-t-break-the-bank/e54d8d59-17cb-420d-9965-48fa31ce1caa-2070.png",
                        }}
                        style={styles.image}
                    />
                </Pressable>

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

                    {/* Avatars & extra attendees row */}
                    <View style={styles.avatarRow}>
                        <View style={styles.avatarStack}>
                            {goingAvatars.slice(0, 3).map((profile, index) => (
                                <Image
                                    key={profile.userName ?? index}
                                    source={{ uri: profile.avatar }}
                                    style={[
                                        styles.stackedAvatar,
                                        index > 0 && styles.overlappingAvatar,
                                    ]}
                                    onError={(error) => {
                                        console.log(
                                            "Avatar failed:",
                                            profile.userName,
                                            profile.avatar,
                                            error.nativeEvent.error
                                        );
                                    }}
                                />
                            ))}
                        </View>

                        {/* only the overflow gets a "+" — under three people the plain count reads better than "+ -2" */}
                        <Pressable
                            style={styles.badgePill}
                            onPress={() => setAttendeesVisible(true)}
                        >
                            <Text style={styles.badgeText}>
                                {attendingCount > 3
                                    ? `+ ${attendingCount - 3} attending`
                                    : `${attendingCount} attending`}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            {/* Event Description */}
            {event.description ? (
                <Text style={styles.descriptionText}>{event.description}</Text>
            ) : null}

            <Text style={styles.host}>
                Hosted by: @{host}
            </Text>
            {/* Action Buttons Row - map + chat */}
            <View style={styles.actionsRow}>
                <Pressable
                    style={styles.actionPill}
                    onPress={() =>
                        navigation?.navigate?.("EventMap", { event })
                    }
                >
                    <Text style={styles.actionText}>View on map</Text>
                </Pressable>

                <Pressable
                    style={styles.actionPill}
                    onPress={() =>
                        navigation?.navigate?.("UserTab", {
                            screen: "Chat",
                            params: { event },
                        })
                    }
                >
                    <Text style={styles.actionText}>Open chat</Text>
                </Pressable>
            </View>

            {/* RSVP segmented buttons - yes/maybe/no. value/label split so
                the DB stores lowercase but the UI still shows Title Case.
                Each segment gets its own status color (green/yellow/red)
                applied only while it's the selected one. */}
            <View style={styles.rsvpContainer}>
                <SegmentedButtons
                    value={rsvpValue}
                    onValueChange={handleRsvpChange}
                    buttons={[
                        {
                            value: "yes",
                            label: "Yes",
                            style:
                                rsvpValue === "yes"
                                    ? { backgroundColor: RSVP_COLORS.yes }
                                    : undefined,
                            labelStyle:
                                rsvpValue === "yes" ? { color: "#FFFFFF" } : undefined,
                        },
                        {
                            value: "maybe",
                            label: "Maybe",
                            style:
                                rsvpValue === "maybe"
                                    ? { backgroundColor: RSVP_COLORS.maybe }
                                    : undefined,
                            labelStyle:
                                rsvpValue === "maybe" ? { color: "#000000" } : undefined,
                        },
                        {
                            value: "no",
                            label: "No",
                            style:
                                rsvpValue === "no"
                                    ? { backgroundColor: RSVP_COLORS.no }
                                    : undefined,
                            labelStyle:
                                rsvpValue === "no" ? { color: "#FFFFFF" } : undefined,
                        },
                    ]}
                />
            </View>


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

    // make the media grid — filters by active tab now that media_type exists
    const gridData =
        activeTab === "Stories"
            ? eventMedia.filter((item) => item.media_type === "story")
            : eventMedia;

    return (
        <View style={styles.screenRoot}>
            {/* Custom header — replaces the default React Navigation stack
                header for this screen. Shows the event's own title, with a
                back button. Make sure this screen's Stack.Screen entry in
                App.js has headerShown: false, otherwise you'll get two
                headers stacked on top of each other. */}
            <View style={[styles.header, { paddingTop: insets.top + 8, height: 56 + insets.top }]}>
                <TouchableOpacity
                    style={[styles.headerBack, { top: insets.top + 8 }]}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            // no back history (e.g. opened directly / deep link) —
                            // fall back to the hub screen instead of doing nothing
                            navigation.navigate("Postcard");
                        }
                    }}
                    hitSlop={8}
                >
                    <Ionicons name="chevron-back" size={28} color="#000000" />
                </TouchableOpacity>

                <Text style={styles.headerTitle} numberOfLines={1}>
                    {"Event Details"}
                </Text>

                {isHost && (
                    <TouchableOpacity
                        style={[styles.listMenuButton, { top: insets.top + 8 }]}
                        onPress={() =>
                            navigation.navigate("PostcardCreateEventScreen", {
                                eventToEdit: currentEvent,
                                onSaved: refreshEvents,
                            })
                        }
                        hitSlop={8}
                    >
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={22}
                            color="#000000"
                        />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.headerDivider} />

            <FlatList
                style={styles.container}
                data={gridData}
                numColumns={2}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={renderHeader}
                columnWrapperStyle={{ justifyContent: "space-between" }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.storyCard}
                        onPress={() => {
                            if (item.media_type === "story") {
                                setSelectedStory(item);
                                setStoryViewerVisible(true);
                            } else {
                                setSelectedMedia(item);
                                setMediaViewerVisible(true);
                            }
                        }}
                    >
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
                    </Pressable>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        {isLoadingMedia ? "Loading media..." : "No media yet."}
                    </Text>
                }
            />

            {/* FAB action menu — Edit (host only) / Add to Story / Add to Media.
                Lives outside the FlatList now so it stays pinned to the
                bottom-right of the screen instead of scrolling with content. */}
            {menuOpen && (
                <View style={styles.fabMenu}>
                    {isHost && (
                        <Pressable
                            style={styles.fabMenuItem}
                            onPress={() => {
                                setMenuOpen(false);
                                navigation.navigate("PostcardCreateEventScreen", {
                                    eventToEdit: currentEvent,
                                    onSaved: refreshEvents,
                                });
                            }}
                        >
                            <Text style={styles.fabMenuText}>Edit event</Text>
                        </Pressable>
                    )}
                    <Pressable
                        style={styles.fabMenuItem}
                        onPress={() => pickAndUpload("photo", "library")}
                    >
                        <Text style={styles.fabMenuText}>Add to media</Text>
                    </Pressable>
                    <Pressable
                        style={styles.fabMenuItem}
                        onPress={() => pickAndUpload("story", "library", "image")}
                    >
                        <Text style={styles.fabMenuText}>Story from library</Text>
                    </Pressable>
                    <Pressable
                        style={styles.fabMenuItem}
                        onPress={() => pickAndUpload("story", "camera", "image")}
                    >
                        <Text style={styles.fabMenuText}>Story: take photo</Text>
                    </Pressable>
                    <Pressable
                        style={styles.fabMenuItem}
                        onPress={() => pickAndUpload("story", "camera", "video")}
                    >
                        <Text style={styles.fabMenuText}>Story: record video</Text>
                    </Pressable>
                </View>
            )}

            <FAB
                onPress={() => setMenuOpen((prev) => !prev)}
                style={styles.addButton}
                visible={true}
                icon={{ name: "arrow", color: "white" }}
                color="#0FADFF"
            />

            {/* Story viewer — Snap-style: shows who posted it and how long ago */}
            <Modal
                visible={storyViewerVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setStoryViewerVisible(false)}
            >
                <View style={styles.storyViewerContainer}>
                    {selectedStory ? (
                        <>
                            <Image
                                source={{ uri: selectedStory.media }}
                                style={styles.storyViewerImage}
                                resizeMode="contain"
                            />

                            {/* full-area tap-to-close, placed before the header
                                row below so the close button/username stay on
                                top and remain tappable in their own right */}
                            <Pressable
                                style={styles.storyViewerTapArea}
                                onPress={() => setStoryViewerVisible(false)}
                            />

                            {/* progress bar — single segment since this only
                                shows one story at a time, not a full carousel */}
                            <View style={styles.storyProgressTrack}>
                                <View style={styles.storyProgressFill} />
                            </View>

                            {/* poster info row */}
                            <View style={styles.storyHeaderRow}>
                                <Image
                                    source={{ uri: selectedStory.profiles?.avatar }}
                                    style={styles.storyViewerAvatar}
                                />
                                <View style={styles.storyHeaderText}>
                                    <Text style={styles.storyViewerUsername}>
                                        {selectedStory.profiles?.userName ?? "Someone"}
                                    </Text>
                                    <Text style={styles.storyViewerTimeAgo}>
                                        {timeAgo(selectedStory.date_added)}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => saveMediaToDevice(selectedStory.media)}
                                    hitSlop={12}
                                    disabled={isSavingMedia}
                                    style={{ marginRight: 16 }}
                                >
                                    <Text style={styles.storyViewerSaveText}>
                                        {isSavingMedia ? "Saving..." : "Save"}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setStoryViewerVisible(false)}
                                    hitSlop={12}
                                >
                                    <Text style={styles.storyViewerClose}>✕</Text>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <Pressable
                            style={styles.storyViewerTapArea}
                            onPress={() => setStoryViewerVisible(false)}
                        >
                            <Text style={styles.storyViewerEmptyText}>
                                No stories posted yet.
                            </Text>
                        </Pressable>
                    )}
                </View>
            </Modal>

            {/* Media preview + save — opens when tapping a non-story photo tile */}
            <Modal
                visible={mediaViewerVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setMediaViewerVisible(false)}
            >
                <View style={styles.storyViewerContainer}>
                    {selectedMedia && (
                        <>
                            <Image
                                source={{ uri: selectedMedia.media }}
                                style={styles.storyViewerImage}
                                resizeMode="contain"
                            />
                            <Pressable
                                style={styles.storyViewerTapArea}
                                onPress={() => setMediaViewerVisible(false)}
                            />
                            <View style={styles.mediaViewerTopRow}>
                                <Pressable
                                    onPress={() => saveMediaToDevice(selectedMedia.media)}
                                    hitSlop={12}
                                    disabled={isSavingMedia}
                                    style={styles.mediaViewerSaveButton}
                                >
                                    <Text style={styles.storyViewerSaveText}>
                                        {isSavingMedia ? "Saving..." : "Save to Photos"}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setMediaViewerVisible(false)}
                                    hitSlop={12}
                                >
                                    <Text style={styles.storyViewerClose}>✕</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            {/* Attendees bottom sheet — opens from the "+ X attending" badge.
                Lists everyone invited with their RSVP status on the right. */}
            <Modal
                visible={attendeesVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAttendeesVisible(false)}
            >
                {/* tap the dark overlay outside the sheet to dismiss */}
                <Pressable
                    style={styles.attendeesOverlay}
                    onPress={() => setAttendeesVisible(false)}
                >
                    {/* stop taps inside the sheet itself from closing it */}
                    <Pressable style={styles.attendeesSheet} onPress={() => { }}>
                        <View style={styles.attendeesHandle} />
                        <Text style={styles.attendeesTitle}>
                            {avatar.length} invited · {attendingCount} going
                        </Text>
                        <FlatList
                            data={avatar}
                            keyExtractor={(item, index) => item.user ?? String(index)}
                            renderItem={({ item }) => {
                                const badge = rsvpBadgeColors(item.status);

                                return (
                                    <View style={styles.attendeeRow}>
                                        <Image
                                            source={{ uri: item.avatar }}
                                            style={styles.attendeeAvatar}
                                        />

                                        <View style={styles.attendeeNameBlock}>
                                            <Text style={styles.attendeeName}>
                                                {item.userName ?? "Unknown"}
                                            </Text>
                                            {item.role === "host" ? (
                                                <Text style={styles.attendeeRole}>Host</Text>
                                            ) : null}
                                        </View>

                                        <View
                                            style={[
                                                styles.attendeeStatusPill,
                                                { backgroundColor: badge.background },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.attendeeStatusText,
                                                    { color: badge.text },
                                                ]}
                                            >
                                                {RSVP_LABELS[item.status] ?? "No reply"}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <Text style={styles.attendeesEmptyText}>
                                    {isLoadingAvatar
                                        ? "Loading..."
                                        : "No one invited yet."}
                                </Text>
                            }
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screenRoot: {
        flex: 1,
        position: "relative",
    },
    addButton: {
        position: "absolute",
        bottom: 24,
        right: 24,
        zIndex: 20,
    },
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 48, // leave room for the back button on the left
        backgroundColor: "#FFF",
    },
    headerBack: {
        position: "absolute",
        left: 12,
        padding: 4,
    },
    listMenuButton: {
        position: "absolute",
        right: 12,
        padding: 6,
        alignItems: "center",
        justifyContent: "center",
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
        marginBottom: 10,
    },
    attending: {
        fontSize: 14,
        color: "#3399ff",
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
    fabMenu: {
        position: "absolute",
        bottom: 90,
        right: 24,
        backgroundColor: "#FFF",
        borderRadius: 14,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
        zIndex: 25,
    },
    fabMenuItem: {
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    fabMenuText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    storyViewerContainer: {
        flex: 1,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    storyViewerImage: {
        width: "100%",
        height: "100%",
    },
    storyViewerTapArea: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    storyProgressTrack: {
        position: "absolute",
        top: 54,
        left: 12,
        right: 12,
        height: 3,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.35)",
    },
    storyProgressFill: {
        height: "100%",
        width: "100%",
        borderRadius: 2,
        backgroundColor: "#FFF",
    },
    storyHeaderRow: {
        position: "absolute",
        top: 66,
        left: 12,
        right: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    storyViewerAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: "#FFF",
        backgroundColor: "#555",
        marginRight: 10,
    },
    storyHeaderText: {
        flex: 1,
    },
    storyViewerUsername: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "700",
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    storyViewerTimeAgo: {
        color: "#EAEAEA",
        fontSize: 12,
        marginTop: 2,
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    storyViewerClose: {
        color: "#FFF",
        fontSize: 22,
        fontWeight: "600",
        paddingHorizontal: 6,
    },
    storyViewerSaveText: {
        color: "#FFFC00",
        fontSize: 14,
        fontWeight: "700",
    },
    storyViewerEmptyText: {
        color: "#FFF",
        fontSize: 16,
    },
    mediaViewerTopRow: {
        position: "absolute",
        top: 54,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    mediaViewerSaveButton: {
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    attendeesOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    attendeesSheet: {
        backgroundColor: "#FBFBF5",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 30,
        maxHeight: "70%",
    },
    attendeesHandle: {
        alignSelf: "center",
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D6D6D6",
        marginBottom: 14,
    },
    attendeesTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#000000",
        marginBottom: 12,
    },
    attendeeRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#FFFFE1",
    },
    attendeeAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#FFFFE1",
        marginRight: 12,
    },
    attendeeNameBlock: {
        flex: 1,
    },
    attendeeName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#000000",
    },
    attendeeRole: {
        fontSize: 12,
        fontWeight: "600",
        color: "#8E8E93",
        marginTop: 2,
    },
    attendeeStatusPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        marginLeft: 10,
    },
    attendeeStatusText: {
        fontSize: 12,
        fontWeight: "700",
    },
    attendeesEmptyText: {
        textAlign: "center",
        color: "#8E8E93",
        marginTop: 20,
    },
});