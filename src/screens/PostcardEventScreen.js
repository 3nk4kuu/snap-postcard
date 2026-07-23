import React, { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, FlatList, Dimensions, ScrollView } from "react-native";
import { supabase } from "../../utils/hooks/supabase";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2; // Split width into 2 equal columns with padding

// Story mock items matching your UI design
const STORIES_DATA = [
  {
    id: "1",
    user: "Emma",
    caption: "who let us co...",
    uri: "https://static01.nyt.com/images/2018/11/04/fashion/04THELOOK16-LN/merlin_145551174_248a1478-7dec-4517-ac5f-d7bae81f7c53-articleLarge.jpg?quality=75&auto=webp&disable=upscale",
    avatar: "https://sdk.bitmoji.com/render/panel/bc963ec3-b263-4707-9d30-e560a511d8db-c648bc89-b69a-4501-8af9-bdd9644bda14-v1.png?transparent=1&palette=1",
  },
  {
    id: "2",
    user: "Connor",
    caption: "the lore is exp...",
    uri: "https://i.pinimg.com/736x/97/69/54/97695465594649a3844edeee9790d4aa.jpg",
    avatar: "https://sdk.bitmoji.com/render/panel/74199580-3d4e-4477-8454-45c0e64aaa76-89c810f5-a6bd-40aa-8b77-4828ded96042-v1.png?transparent=1&palette=1",
  },
  {
    id: "3",
    user: "John",
    caption: "mentally here",
    uri: "https://i.pinimg.com/736x/29/33/87/293387ada898b684a05b5385a55e7788.jpg",
    avatar: "https://sdk.bitmoji.com/render/panel/bc963ec3-b263-4707-9d30-e560a511d8db-c648bc89-b69a-4501-8af9-bdd9644bda14-v1.png?transparent=1&palette=1",
  },
  {
    id: "4",
    user: "Emma",
    caption: "locked in 🔒",
    uri: "https://i.pinimg.com/1200x/75/0e/1d/750e1d89741abfbb51c87b79201c027b.jpg",
    avatar: "https://sdk.bitmoji.com/render/panel/74199580-3d4e-4477-8454-45c0e64aaa76-89c810f5-a6bd-40aa-8b77-4828ded96042-v1.png?transparent=1&palette=1",
  },
  {
    id: "5",
    user: "Alex",
    caption: "golden hour",
    uri: "https://static01.nyt.com/images/2018/11/04/fashion/04THELOOK16-LN/merlin_145551174_248a1478-7dec-4517-ac5f-d7bae81f7c53-articleLarge.jpg?quality=75&auto=webp&disable=upscale",
    avatar: "https://sdk.bitmoji.com/render/panel/bc963ec3-b263-4707-9d30-e560a511d8db-c648bc89-b69a-4501-8af9-bdd9644bda14-v1.png?transparent=1&palette=1",
  },
];

export default function PostCardEventScreen({ route, navigation }) {
  // Grab the event object passed from the hub screen
  const { event } = route.params;

  // Variable to store attendee count
  const [attendingCount, setAttendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState("Stories");

  useEffect(() => {
    if (!event?.id) return;

    const fetchCount = async () => {
      const { count, error } = await supabase
        .from("attending")
        .select("*", { count: "exact", head: true })
        .eq("event", Number(event.id));

      if (error) {
        console.error("Error fetching attending count:", error);
      } else if (count !== null) {
        setAttendingCount(count);
      }
    };

    fetchCount();
  }, [event?.id]);

  // Header element containing top event details
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Event Header */}
      <View style={styles.eventInfoSection}>
        <Image
          source={{
            uri: "https://s3.amazonaws.com/media.theteenmagazine.com/ckeditor_uploads/posts/6-unique-hangout-ideas-to-do-with-your-friends-that-won-t-break-the-bank/e54d8d59-17cb-420d-9965-48fa31ce1caa-2070.png",
          }}
          style={styles.image}
        />
        <View style={styles.eventDetails}>
          <Text style={styles.title}>{event.title}</Text>

          {/* Date pill */}
          <View style={styles.datePill}>
            <Text style={styles.dateText}>{event.start_datetime}</Text>
          </View>

          {/* Avatars & extra attendees row */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarStack}>
              <Image
                source={{
                  uri: "https://sdk.bitmoji.com/render/panel/bc963ec3-b263-4707-9d30-e560a511d8db-c648bc89-b69a-4501-8af9-bdd9644bda14-v1.png?transparent=1&palette=1",
                }}
                style={styles.stackedAvatar}
              />
              <Image
                source={{
                  uri: "https://sdk.bitmoji.com/render/panel/74199580-3d4e-4477-8454-45c0e64aaa76-89c810f5-a6bd-40aa-8b77-4828ded96042-v1.png?transparent=1&palette=1",
                }}
                style={[styles.stackedAvatar, { marginLeft: -8 }]}
              />
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>+ 6 attending</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <View style={styles.actionPill}>
          <Text style={styles.actionText}>View on map</Text>
        </View>
        <View style={styles.actionPill}>
          <Text style={styles.actionText}>Open Chat</Text>
        </View>
      </View>

      {/* Event Description */}
      {event.description && (
        <Text style={styles.descriptionText}>{event.description}</Text>
      )}

      <Text style={styles.host}>Hosted by: {event.host}</Text>
      <Text style={styles.attending}>{attendingCount} friends attending</Text>

      {/* Tab Header bar */}
      <View style={styles.tabContainer}>
        <View style={[styles.tabButton, activeTab === "Stories" && styles.activeTabButton]}>
          <Text style={[styles.tabText, activeTab === "Stories" && styles.activeTabText]}>
            Stories
          </Text>
        </View>
        <View style={[styles.tabButton, activeTab === "All Media" && styles.activeTabButton]}>
          <Text style={[styles.tabText, activeTab === "All Media" && styles.activeTabText]}>
            All Media
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={STORIES_DATA}
      numColumns={2}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      columnWrapperStyle={{ justifyContent: "space-between" }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      renderItem={({ item }) => (
        <View style={styles.storyCard}>
          <Image source={{ uri: item.uri }} style={styles.storyImage} />
          <View style={styles.storyOverlay}>
            <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
            <View style={styles.storyTextContainer}>
              <Text style={styles.storyUser}>{item.user}</Text>
              <Text style={styles.storyCaption} numberOfLines={1}>
                {item.caption}
              </Text>
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
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
    paddingVertical: 8,
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
    color: "#ff3386",
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
});