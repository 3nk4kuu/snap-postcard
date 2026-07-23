import React, {  useMemo, useEffect, useState } from "react";
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
  //const [filteredData, setFilteredData] = useState(data); //for search results

//not needed?
  // function toggleComponent() {
  //   setVisible(!visible);
  // }

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from("events").select("*");

      //console.log("Fetched data:", data);
      //console.log("Fetch stuff");
      //console.log("Fetch error:", error);

      //state variable updates for events right now, today, tomorrow, next week, this month
    

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


// all upcoming events (excluding the live event)
const upcomingEvents = useMemo(() => {
  const now = new Date();

  return filteredEvents.filter((event) => {
    const start = new Date(event.start_datetime);

    return start > now && event.id !== liveEvent?.id;
  });
}, [filteredEvents, liveEvent]);


// Group upcoming events by month
const groupedEvents = useMemo(() => {
  const groups = {};

  upcomingEvents.forEach((event) => {
    const month = new Date(event.start_datetime).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    if (!groups[month]){
      groups[month] = [];
    }
    groups[month].push(event);
  });

  return Object.entries(groups).sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([title, data]) => ({
      title,
      data: data.sort(
        (a, b) =>
          new Date(a.start_datetime) - new Date(b.start_datetime)
      ),
    }));
}, [upcomingEvents]);



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
      <ScrollView>

          {/* Live card */}
        {/*Live Card - current time is between start and end time */}
        {liveEvent && (
          <View style={styles.liveCard}>
            {/* Divider */}
            <Text style={styles.sectionHeader}>Happening Now</Text>
            <TouchableOpacity
              style={styles.liveCard}
              onPress={() => 
                navigation.navigate("PostcardEventScreen", {
                  event: liveEvent,
                })
              }
              >
              <Image source={{uri: liveEvent.media }}
              style={styles.liveCardImage}/>
               <View style={styles.liveCardTextContainer}>
                <Card.Title style={styles.liveCardTitle}>
                  {liveEvent.title}
                </Card.Title>
                <Text style={styles.liveCardDate}>
                  {formatTime(liveEvent.start_datetime)} –{" "}
                  {formatTime(liveEvent.end_datetime)}
                </Text>
                <Text style={styles.liveCardDescription}>
                  {liveEvent.attending}
                </Text>
              </View>
            </TouchableOpacity>
            </View>
            )}

            {/* Event list, grouped by month */}
        {groupedEvents.map((section) => (
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
                        {formatMonthDay(event.start_datetime)} ·{" "}
                        {formatTime(event.start_datetime)} –{" "}
                        {formatTime(event.end_datetime)}
                      </Text>
                      <Text style={styles.listDescription}>{event.attending}</Text>
                    </View>
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
        onPress={() =>
          navigation.navigate("PostcardEventScreen")
        }
        style={styles.addButton}
        visible={true}
        icon={<Ionicons name="add" size={28} color="white" />}
        color="#335fff"
      />
      
      {/* not needed? Maybe needed inside event creation? */}
      {/* <AddEvent
        isVisible={visible}
        onClose={() => {
          toggleComponent();
          refreshEvents();
        }}
      /> */}
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
  title: {
    textAlign: "left",
    marginTop: 8,
    marginBottom: 5,
    fontSize: 40,
    fontWeight: '800',
    color: '#000000',
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
    backgroundColor: "#D1D1D6",
  },

  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    marginHorizontal: 16,
    martinTop: 10,
    paddingHorizontal: 10,
    height: 40,
    width: '90%',
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
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  //----------------------
 
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
  liveCardText: {
    fontSize: 13,
    color: '#FFFFFF',
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
  liveCardDescription: {
    fontSize: 13,
    color: '#E9D5FF',
  },

  //lists
  //------------------------
    listRow: {
    backgroundColor: "#FFFFFF",
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    overflow: 'hidden',
  },
  listRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 72, 
  },
  listImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#D1D1D6',
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  listDescription: {
    fontSize: 13,
    color: '#000000',
  },
  listDate: {
    fontSize: 13,
    color: '#3C3C43',
    opacity: 0.7,
    marginBottom: 2,
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
