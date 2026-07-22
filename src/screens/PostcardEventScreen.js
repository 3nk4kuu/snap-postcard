import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PostCardEventScreen({ route, navigation }) {
  const event = route.params?.event;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hi! Event Screen</Text>
      {event && <Text style={styles.subtext}>Title: {event.title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtext: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
});