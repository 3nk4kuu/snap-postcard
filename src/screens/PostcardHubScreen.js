import React, { useMemo, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { Card, FAB } from "@rn-vui/themed";
import { View,Text, TextInput, StyleSheet, Image, Button, TouchableOpacity,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import AddEvent from "../components/AddEvent";
import Ionicons from "@expo/vector-icons/Ionicons";

import { supabase } from "../../utils/hooks/supabase";
import { formatMonthDay, formatTime } from "../../utils/dateFormatUtil";

export default function PostCardHubScreen({ title, navigation }) {
  const [visible, setVisible] = useState(false); //remove if I pull addEvent
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState(""); //for setting search 
  const [media, setMedia] = useState([]); //for setting images for story rendering in list 

 //need to only show event by if attending or not
//need to pull media by story type
//need to fix container visual so attending isn't hidden


  const fetchData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
      console.error("No authenticated user:", userError);
      return;
      }

      const { data, error } = await supabase.
      from("events")
      .select(`*, 
        event_media!event_media_event_fkey(media, date_added), 
        invited!invited_event_fkey!inner(id, status)`)
      .eq("invited.user", user.id)
      .in("invited.status", ["yes", "maybe", "no", "null"]);

       //Based on "profiles" "id", check if attending status in "invited" to "event" is "yes" or "maybe"
       
      if (error) {
        console.error("Error fetching data:", error);
      } else {

        const merged = data.map((event) => ({
          ...event,
          media: event.event_media?.[event.event_media.length -1]?.media ?? null, //if event_media exists, get last item's iamge url (latest)
          status: event.invited?.[0]?.status ?? null,
          role: event.invited?.[0]?.role ?? null,
        }));
        console.log("Merged:", merged[0].event_media);
        setEvents(merged);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    }
  };

  const refreshEvents = async () => {
    await fetchData();
  };

  //to re-render while creating events 
  useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [])
);

  // Search events by title or date
  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;

    const userSearch = search.toLowerCase();

    //if the there is a match to the title or date, then return that event in a filtered array
    return events.filter((event) => {
      const matchingTitle = event.title?.toLowerCase().includes(userSearch);
      const matchingDate = formatMonthDay(event.start_datetime)
        ?.toLowerCase()
        .includes(userSearch);

      return matchingTitle || matchingDate;
    });
  }, [events, search]);

  // Event happening right now for live card
  const liveEvent = useMemo(() => {
    const now = new Date();

    return filteredEvents.find((event) => {
      const start = new Date(event.start_datetime);
      const end = new Date(event.end_datetime);

      return now >= start && now <= end;
    });
  }, [filteredEvents]);

  // all events excluding the live event
const allEvents = useMemo(() => {
  return filteredEvents.filter((event) => event.id !== liveEvent?.id);
}, [filteredEvents, liveEvent]);

//all upcoming events from allEvents
const upcomingEvents = useMemo(() => {
  const now = new Date();

  return allEvents.filter((event) => {
    const start = new Date(event.start_datetime);

    return start > now && event.id !== liveEvent?.id;
  });
}, [allEvents, liveEvent]);

//all past events from allEvents
const pastEvents = useMemo(() => {
  const now = new Date();

  return allEvents.filter((event) => {
    const end = new Date(event.end_datetime);

    return end < now;
  });
}, [allEvents]);


  // Group all events by month
  const groupedUpcomingEvents = useMemo(() => {
    const groups = {};

    upcomingEvents.forEach((event) => {
      const month = new Date(event.start_datetime).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(event);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([title, data]) => ({
        title,
        data: data.sort(
          (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime),
        ),
      }));
  }, [upcomingEvents]);


  const groupedPastEvents = useMemo(() => {
    const groups = {};

    pastEvents.forEach((event) => {
      const month = new Date(event.start_datetime).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(event);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([title, data]) => ({
        title,
        data: data.sort(
          (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime),
        ),
      }));
  }, [pastEvents]);



  return (
    // entire screen
    <View style={styles.EventScreen}>
      {/* Header */}
      <View style={styles.header}>
        {/* back button */}
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Image
          source={require("../../assets/event-badge.png")}
          style={{ width: 40, height: 40, marginRight: 20}}
        />
         <Text style={styles.headerTitle}>Postcards</Text>
      </View>

      {/* Search bar area */}
      <View style={styles.headerDivider} />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#8E8E93"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#8E8E93"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Icon row in header */}
      <View style={styles.iconRow}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="people" size={20} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="person" size={20} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="location" size={20} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="add" size={20} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* rest of page */}

      {/* Event list */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Live card */}
        {/*Live Card - current time is between start and end time */}
        <Text style={styles.sectionHeader}>Happening Now</Text>
        {liveEvent && (
          <View style={styles.liveCard}>
            {/* Divider */}
            <TouchableOpacity
              style={styles.liveCard}
              onPress={() => 
                navigation.navigate("PostCardEventScreen", {
                  event: liveEvent,
                })
              }
            >
              <Image
                source={{ uri: liveEvent.media }}
                style={styles.liveCardImage}
              />
              <View style={styles.liveCardTextContainer}>
                <Card.Title style={styles.liveCardTitle}>
                  {liveEvent.title}
                </Card.Title>
                <Text style={styles.liveCardDate}>
                  {formatMonthDay(liveEvent.start_datetime)} {" "}
                </Text>
                <Text style={styles.liveCardDate}>
                  {formatTime(liveEvent.start_datetime)} –{" "}
                  {formatTime(liveEvent.end_datetime)}
                </Text>
                <Text style={styles.liveCardDescription}>
                  {liveEvent.status}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Upcoming Event list, grouped by month */}
        <Text style={styles.sectionHeader}>Upcoming Events</Text>
        {groupedUpcomingEvents.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.listCard}>
              {section.data.map((event, index) => (
                <View key={event.id}>
                  <TouchableOpacity
                    style={styles.listRow}
                    onPress={() =>
                      navigation.navigate("PostCardEventScreen", { event })
                    }
                  >
                    <Image
                      source={{ uri: event.media }}
                      style={styles.listImage}
                    />
                    <View style={styles.listText}>
                      <Card.Title style={styles.listTitle}>
                        {event.title}
                      </Card.Title>
                      <Text style={styles.listDate}>
                      {formatMonthDay(event.start_datetime)} {" "}
                      </Text>
                      <Text style={styles.listDate}>
                        {formatTime(event.start_datetime)} –{" "}
                        {formatTime(event.end_datetime)}
                      </Text>
                      <Text style={styles.listDescription}>
                        {event.status}
                      </Text>
                      
    
                      <Text style={styles.listDescription}>{event.attending}</Text>
                    </View>
                    {/* edit button */}
                      {/* <TouchableOpacity
                        style={styles.listMenuButton}
                        onPress={() => navigation.navigate("PostcardEventScreen", {event})}>
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={20}
                            color={styles.listMenuDots.color}
                          />
                        </TouchableOpacity> */}
                  </TouchableOpacity>
                  {index < section.data.length - 1 && (
                    <View style={styles.listRowDivider} />
                  )}
                
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.sectionHeader}>Past Hangouts</Text>
        {/* past events grouped by month */}
        {groupedPastEvents.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.listCard}>
              {section.data.map((event, index) => (
                <View key={event.id}>
                  <TouchableOpacity
                    style={styles.listRow}
                    onPress={() =>
                      navigation.navigate("PostCardEventScreen", { event })
                    }
                  >
                    <Image
                      source={{ uri: event.media }}
                      style={styles.listImage}
                    />
                    <View style={styles.listText}>
                      <Card.Title style={styles.listTitle}>
                        {event.title}
                      </Card.Title>
                      <Text style={styles.listDate}>
                      {formatMonthDay(event.start_datetime)} {" "}
                      </Text>
                      <Text style={styles.listDate}>
                        {formatTime(event.start_datetime)} –{" "}
                        {formatTime(event.end_datetime)}
                      </Text>
                      <Text style={styles.listDescription}>
                        {event.status}
                      </Text>
                      
    
                      <Text style={styles.listDescription}>{event.attending}</Text>
                    </View>
                    {/* edit button */}
                      {/* <TouchableOpacity
                        style={styles.listMenuButton}
                        onPress={() => navigation.navigate("PostcardEventScreen", {event})}>
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={20}
                            color={styles.listMenuDots.color}
                          />
                        </TouchableOpacity> */}
                  </TouchableOpacity>
                  {index < section.data.length - 1 && (
                    <View style={styles.listRowDivider} />
                  )}
                
                </View>
              ))}
            </View>
          </View>
        ))}

      </ScrollView>

      <FAB
        onPress={() => {
          navigation.navigate("PostcardCreateEventScreen", {
            onCreated: refreshEvents,
          });
        }}
        style={styles.addButton}
        visible={true}
        icon={<Ionicons name="add" size={28} color="white" />}
        color="#335fff"
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
  scrollContent: {
    paddingBottom: 100,
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
  title: {
    textAlign: "left",
    marginTop: 8,
    marginBottom: 5,
    fontSize: 40,
    fontWeight: "800",
    color: "#000000",
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
    marginTop: 60,
    height: "100%",
  },
  //----------------------------
    header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    paddingTop: 20,
    backgroundColor: '#FFFFFF',
  },
  headerBackButton: {
    position: "absolute",
    left: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D1D6",
  },
//----------------------------
  // Search bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    marginHorizontal: 16,
    martinTop: 10,
    paddingHorizontal: 10,
    height: 40,
    width: "90%",
  },
  searchIcon: {
    marginRight: 6,
    color: "#8E8E93",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
  },
  searchScanIcon: {
    marginLeft: 6,
    color: "#8E8E93",
  },
 //----------------------------
//Icon row (people / contact / location / add)
  iconRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
 //----------------------------
  // Section headers ("Happening Now", "July 2026", etc.)
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 5,
  },

 
//----------------------------
  // "Happening Now" highlighted card
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7115CA', // purple
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 6,
  },
  liveCardImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 12,
  },
  liveCardTextContainer: {
    flex: 1,
  },
  liveCardText: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  liveCardTitle: {
    textAlign: "left",
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  liveCardDate: {
    fontSize: 13,
    color: "#E9D5FF",
    marginBottom: 2,
  },
  liveCardDescription: {
    fontSize: 13,
    color: "#E9D5FF",
  },
//----------------------------
  //lists
    listRow: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#c6c5c5',
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    overflow: "hidden",
  },
  listRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginLeft: 72,
  },
  listImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 12,
    backgroundColor: "#D1D1D6",
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    textAlign: "left",
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  listDescription: {
    fontSize: 13,
    color: "#000000",
  },
  listDate: {
    fontSize: 13,
    color: "#3C3C43",
    opacity: 0.7,
    marginBottom: 2,
  },
  listMenuButton: {
    padding: 8,
  },
  listMenuDots: {
    color: "#3C3C43",
  },
  //----------------------------
  fab: { //floating action button
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2F87F5", // blue
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6, // Android shadow
  },
});