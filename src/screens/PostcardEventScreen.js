import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

// Destructure navigation and route from props
export default function PostCardEventScreen({ route, navigation }) {
    // Grab the event object passed from the hub screen
    const { event } = route.params;

    return (
        <View style={styles.container}>
            <View style={styles.eventInfoSection}>
                <Image
                    source={{ uri: 'https://s3.amazonaws.com/media.theteenmagazine.com/ckeditor_uploads/posts/6-unique-hangout-ideas-to-do-with-your-friends-that-won-t-break-the-bank/e54d8d59-17cb-420d-9965-48fa31ce1caa-2070.png' }}
                    style={styles.image}
                />
                <View style={styles.eventDetails}>
                    <Text style={styles.title}>{event.title}</Text>

                    {/* Date pill match from image */}
                    <View style={styles.datePill}>
                        <Text style={styles.dateText}>{event.start_datetime}</Text>
                    </View>
                </View>
            </View>

            <Text style={styles.host}>Hosted by: {event.host}</Text>
            <Text style={styles.attending}>{event.attending} friends attending</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#FFF",
    },
    eventInfoSection: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    image: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 14,
    },
    eventDetails: {
        flex: 1,
        alignItems: "flex-start",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#000",
        marginBottom: 6,
    },
    datePill: {
        backgroundColor: "#F2F2F6",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    dateText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#6E6E73",
    },
    avatarStack: {
        flexDirection: "row",
        alignItems: "center",
    },
    stackedAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#FFF",
    },
    host: {
        fontSize: 16,
        color: "#575757",
        marginTop: 10,
    },
    attending: {
        fontSize: 14,
        color: "#ff3386",
        marginTop: 5,
    },
});