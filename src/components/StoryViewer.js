import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
} from "react-native";
// NOTE: requires `expo-av` — if not installed yet:
//   npx expo install expo-av
import { Video, ResizeMode } from "expo-av";
import { timeAgo } from "../../utils/eventDateUtil";

// how long a photo story stays on screen. videos use their own duration.
const IMAGE_DURATION_MS = 5000;
// a story only counts as "seen" once it's been on screen this long, so
// tapping through quickly doesn't silently mark everything read
const SEEN_DWELL_MS = 700;
// press shorter than this is a tap (advance), longer is a hold (pause)
const TAP_MAX_MS = 250;

const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm"];

function isVideo(url) {
  if (!url) return false;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Full-screen story carousel.
 *
 * `stories` should already be in the order they'll play (oldest first).
 * Tapping advances; holding pauses; finishing the last story closes.
 * `onViewed` fires once per story after a short dwell so the caller can
 * record it in story_views.
 */
export default function StoryViewer({
  visible,
  stories = [],
  initialIndex = 0,
  onClose,
  onViewed,
  onSave,
  isSaving,
}) {
  const [index, setIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const pausedAtRef = useRef(0);
  const pressStartRef = useRef(0);
  const videoRef = useRef(null);

  const story = stories[index];
  const storyIsVideo = isVideo(story?.media);

  // the parent redefines onViewed on every render, so hold it in a ref —
  // otherwise the effect below tears down and restarts each time the
  // parent re-renders, which is exactly what marking a story seen causes
  const onViewedRef = useRef(onViewed);
  useEffect(() => {
    onViewedRef.current = onViewed;
  }, [onViewed]);

  // ids already reported this session, so a story is only sent once
  const reportedRef = useRef([]);

  // jump to wherever the caller wants to start each time we open
  useEffect(() => {
    if (!visible) return;

    setIndex(initialIndex);
    setIsPaused(false);
    pausedAtRef.current = 0;
    reportedRef.current = [];
    progressAnim.setValue(0);
  }, [visible, initialIndex, progressAnim]);

  // photo timer. videos drive their own progress from playback status.
  useEffect(() => {
    if (!visible || !story || storyIsVideo || isPaused) return;

    const fromValue = pausedAtRef.current;
    progressAnim.setValue(fromValue);

    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: IMAGE_DURATION_MS * (1 - fromValue),
      easing: Easing.linear,
      useNativeDriver: false, // animating width
    });

    animationRef.current.start(({ finished }) => {
      if (finished) goToNext();
    });

    return () => {
      if (animationRef.current) animationRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index, storyIsVideo, isPaused]);

  // reset progress whenever we land on a new story
  useEffect(() => {
    pausedAtRef.current = 0;
    progressAnim.setValue(0);
  }, [index, progressAnim]);

  // mark seen after it's actually been looked at
  useEffect(() => {
    if (!visible || !story?.id) return;
    if (reportedRef.current.includes(story.id)) return;

    const storyId = story.id;
    const timer = setTimeout(() => {
      reportedRef.current.push(storyId);
      if (typeof onViewedRef.current === "function") onViewedRef.current(storyId);
    }, SEEN_DWELL_MS);

    return () => clearTimeout(timer);
  }, [visible, story?.id]);

  function goToNext() {
    pausedAtRef.current = 0;

    if (index + 1 < stories.length) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  }

  function pause() {
    setIsPaused(true);

    if (storyIsVideo) {
      if (videoRef.current) videoRef.current.pauseAsync();
      return;
    }

    progressAnim.stopAnimation((value) => {
      pausedAtRef.current = value;
    });
  }

  function resume() {
    setIsPaused(false);

    if (storyIsVideo && videoRef.current) {
      videoRef.current.playAsync();
    }
  }

  function handlePressIn() {
    pressStartRef.current = Date.now();
    pause();
  }

  function handlePressOut() {
    const heldFor = Date.now() - pressStartRef.current;

    if (heldFor < TAP_MAX_MS) {
      // a tap, not a hold — clear the pause that handlePressIn set,
      // otherwise the next story mounts paused and never counts down
      setIsPaused(false);
      pausedAtRef.current = 0;
      goToNext();
    } else {
      resume();
    }
  }

  // videos report their own position, so the bar tracks real playback
  function handlePlaybackStatus(status) {
    if (!status.isLoaded) return;

    if (status.durationMillis) {
      progressAnim.setValue(
        Math.min(status.positionMillis / status.durationMillis, 1)
      );
    }

    if (status.didJustFinish) goToNext();
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {story ? (
          <>
            {storyIsVideo ? (
              <Video
                ref={videoRef}
                source={{ uri: story.media }}
                style={styles.media}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={!isPaused}
                isLooping={false}
                onPlaybackStatusUpdate={handlePlaybackStatus}
              />
            ) : (
              <Image
                source={{ uri: story.media }}
                style={styles.media}
                resizeMode="contain"
              />
            )}

            {/* tap to advance, hold to pause — sits under the header row
                so the save/close buttons stay tappable on their own */}
            <Pressable
              style={styles.tapArea}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />

            {/* one segment per story: filled behind, animating on the
                current one, empty ahead */}
            <View style={styles.progressRow}>
              {stories.map((item, segmentIndex) => (
                <View key={item.id} style={styles.progressTrack}>
                  {segmentIndex < index ? (
                    <View style={styles.progressFilled} />
                  ) : segmentIndex === index ? (
                    <Animated.View
                      style={[
                        styles.progressFilled,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        },
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            {/* poster info row */}
            <View style={styles.headerRow}>
              <Image
                source={{ uri: story.profiles?.avatar }}
                style={styles.avatar}
              />
              <View style={styles.headerText}>
                <Text style={styles.username}>
                  {story.profiles?.userName ?? "Someone"}
                </Text>
                <Text style={styles.timeAgo}>{timeAgo(story.date_added)}</Text>
              </View>

              <Pressable
                onPress={() => onSave?.(story.media)}
                hitSlop={12}
                disabled={isSaving}
                style={{ marginRight: 16 }}
              >
                <Text style={styles.saveText}>
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </Pressable>

              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable style={styles.tapArea} onPress={onClose}>
            <Text style={styles.emptyText}>No stories posted yet.</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  tapArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  progressRow: {
    position: "absolute",
    top: 54,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFilled: {
    height: "100%",
    width: "100%",
    borderRadius: 2,
    backgroundColor: "#FFF",
  },

  headerRow: {
    position: "absolute",
    top: 66,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#FFF",
    backgroundColor: "#555",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  username: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timeAgo: {
    color: "#EAEAEA",
    fontSize: 12,
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  saveText: {
    color: "#FFFC00",
    fontSize: 14,
    fontWeight: "700",
  },
  close: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "600",
    paddingHorizontal: 6,
  },
  emptyText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: "auto",
  },
});