import React, { useState, useCallback, useEffect } from "react";
import { GiftedChat } from "react-native-gifted-chat";
import { useHeaderHeight } from "@react-navigation/elements";

export function BasicChatbot() {
  const [messages, setMessages] = useState([]);

  // keyboardVerticalOffset = distance from screen top to GiftedChat container
  // useHeaderHeight() returns status bar + navigation header height
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    setMessages([
      {
        _id: 1,
        text: "Hello developer",
        createdAt: new Date(),
        user: {
          _id: 2,
          name: "John Doe",
          avatar: "https://placeimg.com/140/140/any",
        },
      },
    ]);
  }, []);

  const onSend = useCallback((messages = []) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, messages),
    );
  }, []);

  return (
    <GiftedChat
      messages={messages}
      onSend={(messages) => onSend(messages)}
      user={{
        _id: 1,
      }}
      keyboardAvoidingViewProps={{ keyboardVerticalOffset: headerHeight }}
    />
  );
}
