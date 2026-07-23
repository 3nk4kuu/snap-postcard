import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "../../utils/hooks/supabase";
import DateTimeSheet from "../components/DateTimeSheet";
import {
  HOUR_IN_MS,
  roundUpToHalfHour,
  addDays,
  startOfDay,
  endOfDay,
  getUpcomingWeekend,
  derivePreset,
  toLocalTimestamp,
  formatRangeSummary,
} from "../../utils/eventDateUtil";

/* ------------------------------------------------------------------
 * Create / Edit event screen
 * Pass `route.params.eventToEdit` (a full event row) to open this in
 * edit mode — the form pre-fills, the save button updates that row
 * instead of inserting a new one, and a delete button appears at the
 * bottom. Leave it out to create a new event.
 * ---------------------------------------------------------------- */

export default function PostcardCreateEventScreen({ navigation, route }) {
  const eventToEdit = route?.params?.eventToEdit;
  const isEditMode = Boolean(eventToEdit?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [startDatetime, setStartDatetime] = useState(null);
  const [endDatetime, setEndDatetime] = useState(null);
  const [isAllDay, setIsAllDay] = useState(false);

  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // current logged-in user — same pattern as PostCardEventScreen
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);

  // in edit mode the host is the event's host, not whoever tapped edit
  const hostId = isEditMode ? eventToEdit?.host : currentUserId;

  // pre-fill the form when opened in edit mode
  useEffect(() => {
    if (!eventToEdit) return;

    setTitle(eventToEdit.title ?? "");
    setDescription(eventToEdit.description ?? "");
    setLocation(eventToEdit.location ?? "");
    setStartDatetime(
      eventToEdit.start_datetime ? new Date(eventToEdit.start_datetime) : null
    );
    setEndDatetime(
      eventToEdit.end_datetime ? new Date(eventToEdit.end_datetime) : null
    );
    setIsAllDay(Boolean(eventToEdit.is_all_day));
  }, [eventToEdit]);

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

  useEffect(() => {
    const fetchHostProfile = async () => {
      if (!hostId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("userName, avatar")
        .eq("id", hostId)
        .single();

      if (error) {
        console.error("Error fetching host profile:", error);
        return;
      }

      setHostProfile(data);
    };

    fetchHostProfile();
  }, [hostId]);

  function applyPreset(preset) {
    const now = new Date();
    const roundedTime = roundUpToHalfHour(now);

    let baseDay = now;
    if (preset === "tomorrow") baseDay = addDays(now, 1);
    if (preset === "weekend") baseDay = getUpcomingWeekend(now);

    if (isAllDay) {
      setStartDatetime(startOfDay(baseDay));
      setEndDatetime(endOfDay(baseDay));
    } else {
      const nextStart = new Date(baseDay);
      nextStart.setHours(roundedTime.getHours(), roundedTime.getMinutes(), 0, 0);
      setStartDatetime(nextStart);
      setEndDatetime(new Date(nextStart.getTime() + HOUR_IN_MS));
    }
  }

  function handleSheetConfirm({ start, end, isAllDay: nextAllDay }) {
    setStartDatetime(start);
    setEndDatetime(end);
    setIsAllDay(nextAllDay);
    setIsSheetVisible(false);
  }

  const canCreate =
    title.trim().length > 0 && location.trim().length > 0 && Boolean(startDatetime);

 
    //  Host goes on the guest list 
    // Mirrors the RSVP upsert on PostCardEventScreen: same onConflict target, and status uses same yes/maybe/no
    // as RSVP buttons, so the host's own RSVP shows as "Yes" instead of coming up blank
    // upsert also absorbs the row that the on_event_created trigger inserts.
  async function upsertHostInvite(eventId, userId) {
    const { error } = await supabase.from("invited").upsert(
      {
        event: Number(eventId),
        user: userId,
        role: "host",
        status: "yes",
      },
      { onConflict: "event,user" }
    );

    if (error) console.error("Error adding host to invited:", error);
  }

  async function handleCreateEvent() {
    if (!canCreate || isSaving) return;

    setIsSaving(true);

    try {
      if (!currentUserId) {
        Alert.alert("Sign in required", "Sign in again to create an event.");
        setIsSaving(false);
        return;
      }

      // EDIT MODE — update the existing row instead of inserting a new one
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("events")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            start_datetime: toLocalTimestamp(startDatetime),
            end_datetime: endDatetime ? toLocalTimestamp(endDatetime) : null,
            is_all_day: isAllDay,
            location: location.trim(),
          })
          .eq("id", Number(eventToEdit.id));

        if (updateError) {
          console.error("Error updating event:", updateError);
          Alert.alert("Event not updated", "Something went wrong. Try again.");
          setIsSaving(false);
          return;
        }

        if (typeof route?.params?.onSaved === "function") {
          route.params.onSaved();
        }

        navigation.goBack();
        return;
      }

      // CREATE MODE
      const { data: createdEvent, error: eventError } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          start_datetime: toLocalTimestamp(startDatetime),
          end_datetime: endDatetime ? toLocalTimestamp(endDatetime) : null,
          is_all_day: isAllDay,
          location: location.trim(),
          host: currentUserId,
        })
        .select()
        .single();

      if (eventError) {
        console.error("Error creating event:", eventError);
        Alert.alert("Event not created", "Something went wrong. Try again.");
        setIsSaving(false);
        return;
      }

      await upsertHostInvite(createdEvent.id, currentUserId);

      if (typeof route?.params?.onCreated === "function") {
        route.params.onCreated();
      }

      navigation.goBack();
    } catch (error) {
      console.error("Unexpected error creating event:", error);
      Alert.alert(
        isEditMode ? "Event not updated" : "Event not created",
        "Something went wrong. Try again."
      );
      setIsSaving(false);
    }
  }

  async function deleteEvent() {
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", Number(eventToEdit.id));

      if (error) {
        console.error("Error deleting event:", error);

        // 23503: rows in invited / event_media / event_notes still reference this event, so those foreign keys aren't cascading yet
        if (error.code === "23503") {
          Alert.alert(
            "Event not deleted",
            "This event still has attendees, photos, or notes attached. Those foreign keys need ON DELETE CASCADE in Supabase."
          );
        } else {
          Alert.alert("Event not deleted", "Something went wrong. Try again.");
        }

        setIsDeleting(false);
        return;
      }

      if (typeof route?.params?.onDeleted === "function") {
        route.params.onDeleted();
      }

      // back past the event screen, which would be showing a deleted row
      navigation.navigate("Postcard");
    } catch (error) {
      console.error("Unexpected error deleting event:", error);
      Alert.alert("Event not deleted", "Something went wrong. Try again.");
      setIsDeleting(false);
    }
  }

  function confirmDelete() {
    if (isDeleting) return;

    Alert.alert(
      "Delete this event?",
      "This removes the hangout for everyone invited. It can't be undone.",
      [
        { text: "Keep event", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteEvent },
      ]
    );
  }

  const rangeSummary = formatRangeSummary(startDatetime, endDatetime, isAllDay);
  const activePreset = derivePreset(startDatetime);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={32} color="#000000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEditMode ? "Edit Hangout" : "New Hangout"}
        </Text>
      </View>

      <View style={styles.headerDivider} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>WHAT?</Text>

          <TextInput
            style={styles.textField}
            value={title}
            onChangeText={setTitle}
            placeholder="What are we doing?"
            placeholderTextColor="#8E8E93"
          />

          <TextInput
            style={[styles.textField, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a few details (optional)"
            placeholderTextColor="#8E8E93"
            multiline
          />

          <Text style={styles.sectionLabel}>WHEN?</Text>

          <View style={styles.presetRow}>
            {[
              { key: "today", label: "Today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "weekend", label: "Weekend" },
              { key: "later", label: "Later" },
            ].map((preset) => {
              const selected = activePreset === preset.key;

              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.presetPill, selected && styles.presetPillActive]}
                  onPress={() =>
                    preset.key === "later"
                      ? setIsSheetVisible(true)
                      : applyPreset(preset.key)
                  }
                >
                  <Text
                    style={[styles.presetText, selected && styles.presetTextActive]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setIsSheetVisible(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color="#8E8E93"
              style={styles.pickerIcon}
            />
            <Text
              style={[styles.pickerText, rangeSummary && styles.pickerTextFilled]}
            >
              {rangeSummary || "Date & Time"}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>WHERE TO?</Text>

          <View style={styles.locationField}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#8E8E93"
              style={styles.pickerIcon}
            />
            <TextInput
              style={styles.locationInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Location"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <Text style={styles.sectionLabel}>WHO'S COMING?</Text>

          <View style={styles.attendeeCard}>
            <View style={styles.avatarStack}>
              {hostProfile?.avatar ? (
                <Image
                  source={{ uri: hostProfile.avatar }}
                  style={styles.stackedAvatar}
                />
              ) : (
                <View style={[styles.stackedAvatar, styles.avatarPlaceholder]} />
              )}
            </View>

            <Text style={styles.attendeeSummary}>
              {hostProfile?.userName
                ? isEditMode
                  ? `Hosted by ${hostProfile.userName}`
                  : `Hosting as ${hostProfile.userName}`
                : "Hosting this hangout"}
            </Text>

            {!isEditMode && (
              <TouchableOpacity style={styles.inviteButton} onPress={() => {}}>
                <Text style={styles.inviteButtonText}>Invite More People</Text>
                <Ionicons name="paper-plane-outline" size={18} color="#2F87F5" />
              </TouchableOpacity>
            )}
          </View>

          {/* delete at very bottom */}
          {isEditMode && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FF3B30" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={styles.deleteButtonText}>Delete event</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
            onPress={handleCreateEvent}
            disabled={!canCreate || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.createButtonText,
                  !canCreate && styles.createButtonTextDisabled,
                ]}
              >
                {isEditMode ? "Save changes" : "Create event"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DateTimeSheet
        visible={isSheetVisible}
        initialStart={startDatetime}
        initialEnd={endDatetime}
        initialAllDay={isAllDay}
        onCancel={() => setIsSheetVisible(false)}
        onConfirm={handleSheetConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerBack: {
    position: "absolute",
    left: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D1D6",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
    marginTop: 20,
    marginBottom: 8,
  },

  textField: {
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 17,
    color: "#000000",
    marginBottom: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#F2F2F6",
  },
  presetPillActive: {
    backgroundColor: "#2F87F5",
  },
  presetText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3C3C43",
  },
  presetTextActive: {
    color: "#FFFFFF",
  },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerIcon: {
    marginRight: 8,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: "#8E8E93",
  },
  pickerTextFilled: {
    color: "#000000",
    fontWeight: "600",
  },

  locationField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 4,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: "#000000",
  },

  attendeeCard: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 14,
    padding: 14,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  stackedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#E5E5EA",
  },
  // Ready for when the guest list renders: apply to index > 0
  overlappingAvatar: {
    marginLeft: -8,
  },
  avatarPlaceholder: {
    backgroundColor: "#D1D1D6",
  },
  attendeeSummary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3C3C43",
    marginBottom: 12,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#2F87F5",
    borderRadius: 10,
    paddingVertical: 12,
  },
  inviteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2F87F5",
  },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 28,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF3B30",
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  createButton: {
    backgroundColor: "#2F87F5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#E5E5EA",
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  createButtonTextDisabled: {
    color: "#8E8E93",
  },
});