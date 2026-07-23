import { NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  TransitionPresets,
} from "@react-navigation/stack";
import UserTab from "./UserTab";
import ConversationScreen from "../screens/ConversationScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AddFriendScreen from "../screens/AddFriendScreen";
import DiscoverCard from "../components/DiscoverCard";
import SearchScreen from "../screens/SearchScreen";
import SettingsScreen from "../screens/SettingsScreen";
import FriendStory from "../screens/FriendStory";
import AstrologyScreen from "../screens/AstrologyScreen";
import MemoryScreen from "../screens/MemoryScreen";
import EventScreen from "../screens/EventScreen"; //New component by Sona and Christian
import PostcardHubScreen from "../screens/PostcardHubScreen.js";
import PostCardEventScreen from "../screens/PostcardEventScreen.js";
import PostcardCreateEventScreen from "../screens/PostcardCreateEventScreen.js";
import MapScreen from "../screens/MapScreen"; // reused for the dedicated event-map view below

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="UserTab" component={UserTab} />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="FriendStory"
          component={FriendStory}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="AddFriend"
          component={AddFriendScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Conversation"
          component={ConversationScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="DiscoverCard"
          component={DiscoverCard}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostcardCreateEventScreen"
          component={PostcardCreateEventScreen}
          options={{
            headerShown: false,
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="PostCardEventScreen"
          component={PostCardEventScreen}
          options={{
            headerShown: true,
            title: "Event Details",
          }}
        />
        {/* Dedicated event-location map view. Lives at the top level of the
            stack (not inside UserTab's tab navigator), so:
              - the bottom tab bar never renders here
              - headerShown: true gives a native back arrow for free,
                which pops back to PostCardEventScreen correctly */}
        <Stack.Screen
          name="EventMap"
          component={MapScreen}
          options={{
            headerShown: true,
            title: "Location",
          }}
        />
        <Stack.Screen
          name="MemoryScreen"
          component={MemoryScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Astrology"
          component={AstrologyScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Event"
          component={EventScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="Postcard"
          component={PostcardHubScreen}
          options={{ headerShown: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
