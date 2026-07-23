import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { fontHeader } from "../../assets/themes/font";
import { colors } from "../../assets/themes/colors";
import StoriesBitmoji from "../components/StoriesBitmoji";
import DiscoverFeed from "../components/DiscoverFeed";
import { useNavigation } from "@react-navigation/native";

import Header from "../components/Header";
import { supabase } from "../../utils/hooks/supabase";

/* Discover FlatList will render a component in the list
 * for each object in the array DATA. This is just an example I took
 * from the FlatList documentation, so feel free to change the contents.
 */



export default function StoriesScreen({ route, navigation }) {
  
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState([]);

    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*");
  
  
    
        if (error) {
          console.error("Error fetching data:", error);
        } else {
  
          setProfile(data);
        }
      } catch (error) {
        console.error("Unexpected error:", error);
      }
    };
  
    const refreshEvents = async () => {
      await fetchData();
    };
  
    useEffect(() => {
      fetchData();
    }, []);
  
    //console.log("profile:", profile);

  return (
    <View
      style={[
        styles.container,
        {
          // Paddings to handle safe area
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          marginBottom: tabBarHeight,
        },
      ]}
    >
      <Header title="Stories" />
      <View style={styles.contentContainer}>
        <View style={styles.storyBar}>
          <Text style={styles.sectionHeader}>Friends</Text>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}

            //contentContainerStyle={styles.stories} commented this out because it prevented story scrolling felt unintuitive
          >
           {profile.map((friend) => (
            <StoriesBitmoji
              key={friend.id}
              avatarUrl={friend.avatar}
              username={friend.userName}
              onPress={() => console.log(friend.userName)}
            />
          ))}
          </ScrollView>
        </View>
        <Text style={styles.sectionHeader}>Discover</Text>
        <FlatList
          contentContainerStyle={{ paddingBottom: 250 }}
          data={profile}
          horizontal={false}
          numColumns={2}
          ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
          renderItem={({ item }) => <DiscoverFeed title={item.title} />}
          keyExtractor={(item) => item.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    // padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  storyBar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
  },
  stories: {
    display: "flex",
    gap: 20,
    width: "100%",
    // justifyContent:"center",
  },
  sectionHeader: {
    textAlign: "left",
    paddingVertical: 4,
    color: colors.primary,
    fontSize: fontHeader.fontSize,
    fontFamily: fontHeader.fontFamily,
    fontWeight: fontHeader.fontWeight,
  },
});
