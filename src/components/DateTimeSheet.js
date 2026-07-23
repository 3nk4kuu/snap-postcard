import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Switch,
  Keyboard,
  Platform,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  HOUR_IN_MS,
  roundUpToHalfHour,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
  formatRowDate,
  formatClock,
  parseTypedTime,
  buildMonthGrid,
} from "../../utils/eventDateUtil";

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const WHEEL_PADDING = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

const HOUR_ITEMS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const MINUTE_ITEMS = [
  "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
];
const MERIDIEM_ITEMS = ["AM", "PM"];

//Wheel column — one snapping scroller (hour, minute, or AM/PM)
function WheelColumn({ items, selectedIndex, onChange, width }) {
  const scrollRef = useRef(null);
  const offsetRef = useRef(-1);
  const hasMountedRef = useRef(false);

  // Follow value when it changes from outside (typing, day rollover) but stay out of the way while the user is scrolling column
  useEffect(() => {
    const desired = selectedIndex * WHEEL_ITEM_HEIGHT;
    if (Math.abs(offsetRef.current - desired) < 2) return;

    const animated = hasMountedRef.current;
    const timer = setTimeout(
      () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: desired, animated });
        }
        offsetRef.current = desired;
        hasMountedRef.current = true;
      },
      hasMountedRef.current ? 0 : 40
    );

    return () => clearTimeout(timer);
  }, [selectedIndex]);

  function handleSettle(event) {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(y / WHEEL_ITEM_HEIGHT))
    );

    if (index !== selectedIndex) onChange(index);
  }

  function handlePressItem(index) {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
    }
    offsetRef.current = index * WHEEL_ITEM_HEIGHT;
    onChange(index);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      onScroll={(event) => {
        offsetRef.current = event.nativeEvent.contentOffset.y;
      }}
      onMomentumScrollEnd={handleSettle}
      onScrollEndDrag={handleSettle}
    >
      {items.map((label, index) => (
        <Pressable
          key={label}
          style={styles.wheelItem}
          onPress={() => handlePressItem(index)}
        >
          <Text
            style={[
              styles.wheelItemText,
              index === selectedIndex && styles.wheelItemTextSelected,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Date & time sheet
// All-day row, then start and end rows with the picker opening inline
// underneath whichever row is being edited

export default function DateTimeSheet({
  visible,
  initialStart,
  initialEnd,
  initialAllDay,
  onCancel,
  onConfirm,
}) {
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());
  const [allDay, setAllDay] = useState(false);
  const [activeField, setActiveField] = useState(null); // startDate | startTime | endDate | endTime
  const [viewMonth, setViewMonth] = useState(new Date());
  const [typedTime, setTypedTime] = useState("");
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const windowHeight = useWindowDimensions().height;

  const sheetHeight = Math.round(windowHeight * 0.88);

  const timeInputRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const panelYRef = useRef(0);

  const translateY = useRef(new Animated.Value(0)).current;

  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 110 || gesture.vy > 0.8) {
          Keyboard.dismiss();
          Animated.timing(translateY, {
            toValue: 700,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            cancelRef.current();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Reset to whatever the screen currently holds each time the sheet opens
  useEffect(() => {
    if (!visible) return;

    const fallbackStart = roundUpToHalfHour(new Date());
    const nextStart = initialStart ? new Date(initialStart) : fallbackStart;
    const nextEnd = initialEnd
      ? new Date(initialEnd)
      : new Date(nextStart.getTime() + HOUR_IN_MS);

    setStart(nextStart);
    setEnd(nextEnd);
    setAllDay(Boolean(initialAllDay));
    setActiveField(null);
    setViewMonth(new Date(nextStart));
    setTypedTime("");
    setShowTimeInput(false);
    translateY.setValue(0);
  }, [visible, initialStart, initialEnd, initialAllDay, translateY]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Dismissing keyboard cancels whatever was being typed
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      setTypedTime("");
      setShowTimeInput(false);
    });
    return () => subscription.remove();
  }, []);

  // Focus field when revealed and bring above keyboard
  useEffect(() => {
    if (!showTimeInput) return;

    const focusTimer = setTimeout(() => {
      if (timeInputRef.current) timeInputRef.current.focus();
    }, 60);

    const scrollTimer = setTimeout(() => {
      if (bodyScrollRef.current) {
        bodyScrollRef.current.scrollTo({
          y: Math.max(0, panelYRef.current - 70),
          animated: true,
        });
      }
    }, 180);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(scrollTimer);
    };
  }, [showTimeInput]);

  function toggleField(field) {
    const isTimeField = field === "startTime" || field === "endTime";

    // Time fields cycle: wheels, then wheels plus the typing field, then closed
    if (isTimeField && activeField === field && !showTimeInput) {
      setShowTimeInput(true);
      return;
    }

    Keyboard.dismiss();
    setTypedTime("");
    setShowTimeInput(false);
    setActiveField((current) => (current === field ? null : field));

    if (field === "startDate") setViewMonth(new Date(start));
    if (field === "endDate") setViewMonth(new Date(end));
  }

  function handleStartDateChange(day) {
    const duration = end.getTime() - start.getTime();
    const nextStart = new Date(day);
    nextStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const nextEnd = new Date(nextStart.getTime() + Math.max(duration, 0));

    setStart(nextStart);
    setEnd(nextEnd);
    setActiveField(null);
  }

  function handleStartTimeChange(option, closePanel) {
    const nextStart = new Date(start);
    nextStart.setHours(option.hour, option.minute, 0, 0);

    let nextEnd = new Date(end);
    if (nextEnd.getTime() <= nextStart.getTime()) {
      nextEnd = new Date(nextStart.getTime() + HOUR_IN_MS);
    }

    setStart(nextStart);
    setEnd(nextEnd);

    if (closePanel) {
      setActiveField(null);
      setTypedTime("");
    }
  }

  function handleEndDateChange(day) {
    const nextEnd = new Date(day);
    nextEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);

    if (nextEnd.getTime() <= start.getTime()) {
      setEnd(new Date(start.getTime() + HOUR_IN_MS));
    } else {
      setEnd(nextEnd);
    }

    setActiveField(null);
  }

  // end time before the start rolls the hangout into the next day
  function handleEndTimeChange(option, closePanel) {
    const nextEnd = new Date(end);
    nextEnd.setHours(option.hour, option.minute, 0, 0);

    if (nextEnd.getTime() <= start.getTime()) {
      setEnd(addDays(nextEnd, 1));
    } else {
      setEnd(nextEnd);
    }

    if (closePanel) {
      setActiveField(null);
      setTypedTime("");
    }
  }

  function handleAllDayToggle(nextAllDay) {
    if (nextAllDay) {
      setStart(startOfDay(start));
      setEnd(endOfDay(end));
    } else {
      const defaultTime = roundUpToHalfHour(new Date());
      const nextStart = new Date(start);
      nextStart.setHours(defaultTime.getHours(), defaultTime.getMinutes(), 0, 0);
      setStart(nextStart);
      setEnd(new Date(nextStart.getTime() + HOUR_IN_MS));
    }

    setAllDay(nextAllDay);
    setActiveField(null);
    setTypedTime("");
  }

  function handleCalendarSelect(day) {
    if (activeField === "startDate") handleStartDateChange(day);
    if (activeField === "endDate") handleEndDateChange(day);
  }

  function handleTimeSelect(option, closePanel) {
    if (activeField === "startTime") handleStartTimeChange(option, closePanel);
    if (activeField === "endTime") handleEndTimeChange(option, closePanel);
  }

  function handleTypedTimeSubmit() {
    const reference = activeField === "startTime" ? start : end;
    const parsed = parseTypedTime(typedTime, reference);
    if (!parsed) return;

    Keyboard.dismiss();
    handleTimeSelect(
      { hour: parsed.getHours(), minute: parsed.getMinutes() },
      true
    );
  }

  // time scroll pickers
  function handleWheelChange(part, index) {
    const target = activeField === "startTime" ? start : end;

    let hour12 = target.getHours() % 12;
    let minuteIndex = Math.round(target.getMinutes() / 5) % 12;
    let isPm = target.getHours() >= 12;

    if (part === "hour") hour12 = index;
    if (part === "minute") minuteIndex = index;
    if (part === "meridiem") isPm = index === 1;

    handleTimeSelect(
      { hour: (hour12 % 12) + (isPm ? 12 : 0), minute: minuteIndex * 5 },
      false
    );
  }

  function renderCalendarPanel() {
    const weeks = buildMonthGrid(viewMonth);
    const selectedDay = activeField === "endDate" ? end : start;

    return (
      <View style={styles.panel}>
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
              )
            }
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>

          <Text style={styles.monthLabel}>
            {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </Text>

          <Pressable
            onPress={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
              )
            }
            hitSlop={10}
          >
            <Ionicons name="chevron-forward" size={24} color="#1A1A1A" />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_INITIALS.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <View
                    key={`blank-${weekIndex}-${dayIndex}`}
                    style={styles.dayCell}
                  />
                );
              }

              const selected = isSameDay(day, selectedDay);
              const today = isSameDay(day, new Date());

              return (
                <Pressable
                  key={day.toISOString()}
                  style={styles.dayCell}
                  onPress={() => handleCalendarSelect(day)}
                >
                  <View
                    style={[styles.dayBubble, selected && styles.dayBubbleSelected]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        today && styles.dayTextToday,
                        selected && styles.dayTextSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  function renderTimePanel() {
    const target = activeField === "startTime" ? start : end;
    const preview = typedTime ? parseTypedTime(typedTime, target) : null;

    return (
      <View
        style={styles.panel}
        onLayout={(event) => {
          panelYRef.current = event.nativeEvent.layout.y;
        }}
      >
        {showTimeInput ? (
          <View style={styles.timeInputBlock}>
            <TextInput
              ref={timeInputRef}
              style={[
                styles.timeInput,
                typedTime && !preview && styles.timeInputInvalid,
              ]}
              value={typedTime}
              onChangeText={setTypedTime}
              onSubmitEditing={handleTypedTimeSubmit}
              placeholder="Type a time — 7:30pm or 19:30"
              placeholderTextColor="#8E8E93"
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />

            {typedTime ? (
              <Text
                style={[
                  styles.timeInputHint,
                  !preview && styles.timeInputHintInvalid,
                ]}
              >
                {preview
                  ? `Return to use ${formatClock(preview)}`
                  : "Try a format like 7:30pm or 19:30"}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.wheelRow}>
          <View style={styles.wheelHighlight} pointerEvents="none" />

          <WheelColumn
            items={HOUR_ITEMS}
            selectedIndex={target.getHours() % 12}
            onChange={(index) => handleWheelChange("hour", index)}
            width={52}
          />

          <WheelColumn
            items={MINUTE_ITEMS}
            selectedIndex={Math.round(target.getMinutes() / 5) % 12}
            onChange={(index) => handleWheelChange("minute", index)}
            width={52}
          />

          <WheelColumn
            items={MERIDIEM_ITEMS}
            selectedIndex={target.getHours() >= 12 ? 1 : 0}
            onChange={(index) => handleWheelChange("meridiem", index)}
            width={56}
          />
        </View>

        {!showTimeInput ? (
          <Text style={styles.wheelHint}>Tap the time again to type it.</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.sheetBackdrop}>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Drag area down to dismiss */}
          <View {...panResponder.panHandlers}>
            <View style={styles.grabberArea}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.sheetHeader}>
              <Pressable onPress={onCancel} hitSlop={8}>
                <Text style={styles.sheetCancel}>Cancel</Text>
              </Pressable>

              <Text style={styles.sheetTitle}>Date & time</Text>

              <Pressable
                onPress={() => onConfirm({ start, end, isAllDay: allDay })}
                hitSlop={8}
              >
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={bodyScrollRef}
            style={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.sheetBodyContent,
              { paddingBottom: 16 + keyboardHeight },
            ]}
          >
            {/* All-day */}
            <View style={styles.allDayRow}>
              <Ionicons
                name="time-outline"
                size={22}
                color="#8E8E93"
                style={styles.rowIcon}
              />
              <Text style={styles.allDayLabel}>All-day</Text>
              <Switch
                value={allDay}
                onValueChange={handleAllDayToggle}
                trackColor={{ true: "#2F87F5", false: "#D1D1D6" }}
              />
            </View>

            {/* Start */}
            <View style={styles.timeRow}>
              <View style={styles.rowIcon} />

              <Pressable
                onPress={() => toggleField("startDate")}
                hitSlop={6}
                style={styles.rowDatePress}
              >
                <Text
                  style={[
                    styles.rowText,
                    activeField === "startDate" && styles.rowTextActive,
                  ]}
                >
                  {formatRowDate(start)}
                </Text>
              </Pressable>

              {!allDay ? (
                <Pressable onPress={() => toggleField("startTime")} hitSlop={6}>
                  <Text
                    style={[
                      styles.rowText,
                      activeField === "startTime" && styles.rowTextActive,
                    ]}
                  >
                    {formatClock(start)}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {activeField === "startDate" ? renderCalendarPanel() : null}
            {activeField === "startTime" ? renderTimePanel() : null}

            {/* End */}
            <View style={styles.timeRow}>
              <View style={styles.rowIcon} />

              <Pressable
                onPress={() => toggleField("endDate")}
                hitSlop={6}
                style={styles.rowDatePress}
              >
                <Text
                  style={[
                    styles.rowText,
                    activeField === "endDate" && styles.rowTextActive,
                  ]}
                >
                  {formatRowDate(end)}
                </Text>
              </Pressable>

              {!allDay ? (
                <Pressable onPress={() => toggleField("endTime")} hitSlop={6}>
                  <Text
                    style={[
                      styles.rowText,
                      activeField === "endTime" && styles.rowTextActive,
                    ]}
                  >
                    {formatClock(end)}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {activeField === "endDate" ? renderCalendarPanel() : null}
            {activeField === "endTime" ? renderTimePanel() : null}

            {!activeField ? (
              <Text style={styles.sheetHint}>
                Tap a date or time to change it. Swipe down to close without saving.
              </Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    overflow: "hidden",
  },
  grabberArea: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D1D6",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
  },
  sheetCancel: {
    fontSize: 17,
    color: "#8E8E93",
  },
  sheetDone: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2F87F5",
  },

  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  allDayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowIcon: {
    width: 34,
  },
  allDayLabel: {
    flex: 1,
    fontSize: 17,
    color: "#1A1A1A",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowDatePress: {
    flex: 1,
  },
  rowText: {
    fontSize: 17,
    color: "#1A1A1A",
  },
  rowTextActive: {
    color: "#2F87F5",
    fontWeight: "700",
  },

  panel: {
    paddingLeft: 34,
    paddingBottom: 8,
  },

  timeInput: {
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: "#000000",
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeInputInvalid: {
    borderColor: "#FF3B30",
  },
  timeInputHint: {
    fontSize: 14,
    color: "#2F87F5",
    marginTop: 6,
    marginLeft: 4,
  },
  timeInputHintInvalid: {
    color: "#FF3B30",
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBubbleSelected: {
    backgroundColor: "#2F87F5",
  },
  dayText: {
    fontSize: 17,
    color: "#1A1A1A",
  },
  dayTextToday: {
    fontWeight: "700",
    color: "#2F87F5",
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  timeInputBlock: {
    marginBottom: 4,
  },
  wheelHint: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 10,
  },
  wheelRow: {
    flexDirection: "row",
    justifyContent: "center",
    height: WHEEL_HEIGHT,
    marginTop: 12,
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: WHEEL_ITEM_HEIGHT / 2,
    backgroundColor: "#F2F2F6",
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemText: {
    fontSize: 20,
    color: "#B0B0B5",
  },
  wheelItemTextSelected: {
    fontSize: 22,
    color: "#1A1A1A",
    fontWeight: "600",
  },

  sheetHint: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
});