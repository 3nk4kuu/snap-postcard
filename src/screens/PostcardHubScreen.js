import React, { useEffect, useState } from "react";
import { Card, FAB } from "@rn-vui/themed";
import { View,Text, TextInput, StyleSheet, Image, Button, TouchableOpacity,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import AddEvent from "../components/AddEvent";
import { supabase } from "../../utils/hooks/supabase";


import Ionicons from "@expo/vector-icons/Ionicons";

export default function PostCardHubScreen({ navigation }) {
  const [visible, setVisible] = useState(false);
  const [events, setEvents] = useState([]);

  //const [search, setSearch] = useState(""); //for setting search 
  //const [filteredData, setFilteredData] = useState(data); //for search results


  const happeningNow = {
  id: '1',
  title: 'Bonfire @ Dockweiler',
  date: 'July 16',
  meta: 'Started at 7:00 PM / Jess, Sam, +2',
  image: 'https://example.com/bonfire.jpg',
  }

  function toggleComponent() {
    setVisible(!visible);
  }

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from("events").select("*");

      console.log("Fetched data:", data);
      console.log("Fetch stuff")
      console.log("Fetch error:", error);

      


      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setEvents(data);
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

  //todo: need to make event dividers by date, and happening now section
  //todo: add search bar, banner, and search functionality

  return (
    <View style={styles.EventScreen}>
      {/* Header */}
      <View style={styles.header}>
              <View styles={styles.searchBar}>
                <TextInput styles={styles.searchInput}> Input text here

                </TextInput>
              </View>
      
              <View style={styles.headerIcons}>
                <TouchableOpacity >
                <Ionicons name="calendar" size={25}  />
                </TouchableOpacity>
                <TouchableOpacity>
                <Ionicons name="videocam" size={25} />
                </TouchableOpacity>
                <TouchableOpacity>
                <Ionicons name="call" size={23} />
                </TouchableOpacity>
              </View>
            </View> 
      <ScrollView>
        <View style={styles.Events}>
          {events.map((event) => (
            <TouchableOpacity
            styles={styles.listRow}
              key={event.id}
              // Direct navigation — passes event data to PostCardEventScreen
              onPress={() =>
                navigation.navigate("PostCardEventScreen", { event })
              }
              style={styles.listCard}
            >
              <View styles={styles.listRow}>
                <Text style={styles.listImage}> {event.media} </Text>
                <Card.Title style={styles.listTitle}>{event.title}</Card.Title>
                <View styles={styles.listTimeContainer}>
                  <Text style={styles.listDate}> {event.start_datetime} </Text>
                  <Text style={styles.listDate}> {event.end_datetime} </Text>
                </View>
                <Text style={styles.listMeta}> {event.attending} </Text>
                <Text style={styles.listDescription}> {event.description} </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <FAB
        onPress={toggleComponent}
        style={styles.addButton}
        visible={true}
        icon={{ name: "add", color: "white" }}
        color="#FF3386"
      />
      
      <AddEvent
        isVisible={visible}
        onClose={() => {
          toggleComponent();
          refreshEvents();
        }}
      />
    </View>
    
  );
}

const styles = StyleSheet.create({
  //-----default styling-----------
  Events: {
    padding: 20,
    width: "100%",
    display: "flex",
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  container: {
    width: "48%",
    backgroundColor: "#E5E5E5",
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 20,
    maxHeight: 250,
    margin: 0,
  },
  bitmojiUser: {
    width: 28,
    aspectRatio: 1,
    borderRadius: 1000,
    margin: 0,
  },
  title: {
    textAlign: "left",
    marginTop: 8,
    marginBottom: 5,
    fontSize: 15,
  },
  friends: {
    position: "absolute",
    top: 15,
    left: 15,
    zIndex: 100,
    backgroundColor: "#fffc00",
    margin: 0,
    borderRadius: 20,
    padding: 10,
  },
  friendsText: {
    fontWeight: "bold",
    fontSize: 10,
  },
  username: {
    fontSize: 11,
    margin: 0,
    fontWeight: "bold",
    color: "#575757",
  },
  addButton: {
    position: "absolute",
    bottom: 110,
    right: 30,
  },
  EventScreen: {
    height: "100%",
  },
  //---------------------
    header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D1D6',
  },
  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
    color: '#8E8E93',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
  },
  searchScanIcon: {
    marginLeft: 6,
    color: '#8E8E93',
  },
 
  // Icon row (people / contact / location / add)
  iconRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
 
  // Section headers ("Happening Now", "July 2026", etc.)
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
 //------------------------
  // "Happening Now" highlighted card
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED', // purple
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 12,
  },
  liveCardImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  liveCardTextContainer: {
    flex: 1,
  },
  liveCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  liveCardDate: {
    fontSize: 13,
    color: '#E9D5FF',
    marginBottom: 2,
  },
  liveCardMeta: {
    fontSize: 13,
    color: '#E9D5FF',
  },
  liveCardMenuButton: {
    padding: 8,
  },
  liveCardMenuDots: {
    color: '#FFFFFF',
  },
  //------------------------
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    overflow: 'hidden',
    height: 100,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 72, // aligns with text, not thumbnail
  },
  listImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#D1D1D6',
  },
  
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  listDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  listTimeContainer: {
    flex: 1,
  },
  listDate: {
    fontSize: 13,
    color: '#3C3C43',
    opacity: 0.7,
    marginBottom: 2,
  },
  listMeta: {
    fontSize: 13,
    color: '#8E8E93',
  },
  listMenuButton: {
    padding: 8,
  },
  listMenuDots: {
    color: '#8E8E93',
  },
  fab: { //floating action button
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2F87F5', // blue
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6, // Android shadow
  }
});
