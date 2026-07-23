import React from "react";
import { useState, useEffect } from "react";

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  Button,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../utils/hooks/supabase";
import { Dialog, FAB } from "@rn-vui/themed";

// Pass eventToEdit in when opening this for an existing event (edit mode).
// Leave it undefined/null when creating a brand new event.
// Also pass hostId (the current logged-in user's uuid) — events.host is a
// uuid FK to profiles, so it can't just be a plain string like "someUsername".
export default function EditEvent({ isVisible, onClose, eventToEdit, hostId, onSaved }) {
  const [title, setTitle] = useState("");
  const [descr, setDescr] = useState("");
  const [startDatetime, setStartDatetime] = useState("");
  const [location, setLocation] = useState("");

  const isEditMode = !!eventToEdit?.id;

  // pre-fill the form if we're editing an existing event
  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title ?? "");
      setDescr(eventToEdit.description ?? "");
      setStartDatetime(eventToEdit.start_datetime ?? "");
      setLocation(eventToEdit.location ?? "");
    } else {
      // reset when opening fresh for a new event
      setTitle("");
      setDescr("");
      setStartDatetime("");
      setLocation("");
    }
  }, [eventToEdit]);

  // build the row using only real events columns
  function buildEventPayload() {
    return {
      title,
      description: descr,
      start_datetime: startDatetime,
      location,
      host: hostId,
      // created_on / end_datetime / is_all_day can stay DB defaults or get
      // added here later once the form collects them
    };
  }

  const saveEvent = async () => {
    if (title === "" || startDatetime === "" || location === "") return;

    const payload = buildEventPayload();

    try {
      if (isEditMode) {
        // UPDATE existing event
        const { data, error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", eventToEdit.id)
          .select();

        if (error) {
          console.error("Error updating event:", error);
        } else {
          console.log("Event updated:", data);
          onSaved?.(data?.[0]);
          onClose();
        }
      } else {
        // INSERT new event (let the DB assign the id — it's int8/serial,
        // not something we should generate client-side)
        const { data, error } = await supabase
          .from("events")
          .insert([payload])
          .select();

        if (error) {
          console.error("Error creating event:", error);
        } else {
          console.log("Event created:", data);
          onSaved?.(data?.[0]);
          onClose();
        }
      }
    } catch (error) {
      console.error("Unexpected error saving event:", error);
    }
  };

  return (
    <Dialog
      overlayStyle={styles.DialogueBox}
      isVisible={isVisible}
      onBackdropPress={onClose}
    >
      <Text style={styles.eventText}>
        {isEditMode ? "Edit Event" : "Event Details"}
      </Text>
      <TextInput
        value={title}
        onChangeText={(text) => setTitle(text)}
        style={styles.inputFields}
        placeholder="Title (required)"
      ></TextInput>
      <TextInput
        value={descr}
        onChangeText={(text) => setDescr(text)}
        style={styles.descriptionField}
        placeholder="Description"
      ></TextInput>
      <TextInput
        value={startDatetime}
        onChangeText={(text) => setStartDatetime(text)}
        id="time"
        style={styles.inputFields}
        placeholder="Start date/time (required)"
      ></TextInput>
      <TextInput
        value={location}
        onChangeText={(text) => setLocation(text)}
        style={styles.inputFields}
        placeholder="Location (required)"
      ></TextInput>

      <FAB
        style={styles.closeIcon}
        onPress={onClose}
        color={"none"}
        icon={{ name: "close", color: "black" }}
      />

      <FAB
        style={styles.uploadButton}
        title={isEditMode ? "Save Changes" : "Submit"}
        onPress={saveEvent}
        color="#289CF1"
      />
    </Dialog>
  );
}
const styles = StyleSheet.create({
  userInfo: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "yellow",
    width: "80%",
    // aspectRatio: 1,
    position: "absolute",
    alignSelf: "center",
    top: "20%",
    borderRadius: 20,
    padding: 20,
  },
  DialogueBox: {
    // height: "60%",
    borderRadius: 20,
  },
  eventText: {
    textAlign: "center",
    fontSize: 23,
    fontWeight: "bold",
  },
  inputFields: {
    marginTop: 10,
    backgroundColor: "#F0F0F0",
    padding: 8,
    borderRadius: 5,
  },
  descriptionField: {
    marginTop: 10,
    backgroundColor: "#F0F0F0",
    padding: 8,
    borderRadius: 5,
    paddingBottom: 30,
  },
  otherButtons: {
    backgroundColor: "yellow",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  uploadButton: {
    marginTop: 16,
  },
  closeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
  },
});