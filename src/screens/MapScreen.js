import React, { useState, useEffect, useContext } from "react";
import MapView, { Marker } from "react-native-maps";
import {
  StyleSheet,
  View,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Location from "expo-location";

import Ionicons from "react-native-vector-icons/Ionicons";

export default function MapScreen({ navigation, route }) {
  // useBottomTabBarHeight() throws when not inside a Bottom Tab Navigator.
  // MapScreen is now mounted two ways: as the "Map" tab (inside UserTab,
  // context available) and as the standalone "EventMap" stack screen
  // (outside any tab navigator, context absent). Reading the context
  // directly avoids the throw and just falls back to 0 in the second case.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // event passed in from PostCardEventScreen's "View on map" button
  const event = route?.params?.event;

  // when true, this screen is the focused single-event view (pushed as
  // "EventMap" on the root stack) rather than the general Map tab — in
  // that mode we hide the extra footer buttons, since the header back
  // arrow is the only navigation the user needs here
  const isEventFocusedView = !!event;

  // events only stores a text address (event.location), not lat/lng —
  // this holds the geocoded coordinates once we look the address up
  const [eventCoords, setEventCoords] = useState(null);
  const [geocodeError, setGeocodeError] = useState(null);

  const [currentRegion, setCurrentRegion] = useState({
    latitude: 34.0211573,
    longitude: -118.4503864,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      // only recenter on the user's own location if we don't already
      // have an event to focus on
      if (!event?.location) {
        setCurrentRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    })();
  }, []);

  // geocode the event's text address into real coordinates for the marker
  useEffect(() => {
    if (!event?.location) return;

    const geocodeEvent = async () => {
      try {
        const results = await Location.geocodeAsync(event.location);
        if (results.length === 0) {
          setGeocodeError("Could not find coordinates for this address");
          return;
        }

        const { latitude, longitude } = results[0];
        setEventCoords({ latitude, longitude });
        setCurrentRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (err) {
        console.error("Error geocoding event location:", err);
        setGeocodeError("Error looking up this address");
      }
    };

    geocodeEvent();
  }, [event?.location]);

  let text = "Waiting...";
  text = JSON.stringify(location);

  return (
    <View style={[styles.container, { marginBottom: tabBarHeight }]}>
      <MapView
        style={styles.map}
        region={currentRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {eventCoords && (
          <Marker
            coordinate={eventCoords}
            title={event?.title}
            description={event?.location}
          >
            <Image
              source={require("../../assets/event-badge.png")}
              style={styles.eventMarkerImage}
              resizeMode="contain"
            />
          </Marker>
        )}
      </MapView>

      <View style={[styles.mapFooter]}>
        <View style={styles.locationContainer}>
          <TouchableOpacity
            style={[styles.userLocation, styles.shadow]}
            onPress={() => {
              console.log("Go to user location!");
              const { latitude, longitude } = location.coords;
              setCurrentRegion({ ...currentRegion, latitude, longitude });
            }}
          >
            <Ionicons name="navigate" size={15} color="black" />
          </TouchableOpacity>
        </View>
        {!isEventFocusedView && (
          <View style={[styles.bitmojiContainer, styles.shadow]}>
            <Pressable
              onPress={() => {
                navigation.navigate("Event");
              }}
            >
            </Pressable>
            
            {/*Navigation to postcard hub screen */}
            <Pressable
              onPress={() => {
                navigation.navigate("Postcard");
              }}
            >
              <View style={styles.myBitmoji}>
                <Image
                  source={require("../../assets/event-badge.png")}
                  style={{ width: 50, height: 50 }}
                />
                <View style={styles.bitmojiTextContainer}>
                  <Text style={styles.bitmojiText}>Postcard</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.places}>
              <Image
                style={styles.bitmojiImage}
                source={require("../../assets/snapchat/personalBitmoji.png")}
              />
              <View style={styles.bitmojiTextContainer}>
                <Text style={styles.bitmojiText}>Places</Text>
              </View>
            </View>
            <View style={styles.myFriends}>
              <Image
                style={styles.bitmojiImage}
                source={require("../../assets/snapchat/personalBitmoji.png")}
              />
              <View style={styles.bitmojiTextContainer}>
                <Text style={styles.bitmojiText}>Friends</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  mapFooter: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
    bottom: 0,
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  eventMarkerImage: {
    width: 70,
    height: 70,
  },
  locationContainer: {
    backgroundColor: "transparent",
    width: "100%",
    paddingBottom: 8,
    alignItems: "center",
  },
  userLocation: {
    backgroundColor: "white",
    borderRadius: 100,
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  shadow: {
    shadowColor: "rgba(0, 0, 0)",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 3,
    shadowOpacity: 0.5,
    elevation: 4,
  },
  bitmojiContainer: {
    width: "100%",
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  myBitmoji: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  bitmojiImage: {
    width: 50,
    height: 50,
  },
  bitmojiTextContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 4,
  },
  bitmojiText: {
    fontSize: 10,
    fontWeight: "700",
  },
  places: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  myFriends: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarIcon: {},
});