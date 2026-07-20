import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, SafeAreaView, Platform, Text } from "react-native";
import BasicChatbot from "../chatbots/BasicChatbot";

// prettier-ignore
// export const CHATBOTS = {
//   "BasicChatbot": {
//     id: "BasicChatbot",
//     name: "React Native Chatbot",
//     imageUrl: "https://loremflickr.com/140/140",
//     component: BasicChatbot,
//   },

// };

export default function ChatScreen({ route }) {
  const { chatbotName } = route.params;



  return (
   <Text>Hi from convo screen</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
});
