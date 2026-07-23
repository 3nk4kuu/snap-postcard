import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Switch,
  SafeAreaView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "../../utils/hooks/supabase";

// date helpers
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const HOUR_IN_MS = 60 * 60 * 1000;

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const WHEEL_PADDING = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

const HOUR_ITEMS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const MINUTE_ITEMS = [
  "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
];
const MERIDIEM_ITEMS = ["AM", "PM"];

// 5:18pm -> 5:30pm, 6:49pm -> 7:00pm, 5:30pm stays 5:30pm
function roundUpToHalfHour(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();

  if (minutes === 0 || minutes === 30) return d;

  if (minutes < 30) {
    d.setMinutes(30);
  } else {
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
  }

  return d;
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getUpcomingWeekend(from) {
  const today = new Date(from);
  const day = today.getDay(); // 0 Sun ... 6 Sat

  if (day === 0 || day === 6) return today;

  return addDays(today, 6 - day);
}

// Which preset pill the chosen date lands on. Derived from the date itself so picking a future date in sheet lights up "Later"
function derivePreset(start) {
  if (!start) return null;

  const now = new Date();
  if (isSameDay(start, now)) return "today";
  if (isSameDay(start, addDays(now, 1))) return "tomorrow";
  if (isSameDay(start, getUpcomingWeekend(now))) return "weekend";

  return "later";
}

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

// no time zone so send local wall-clock time rather than toISOString()
// Sending UTC makes the hub read the value back shifted by the local offset
function toLocalTimestamp(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatRowDate(date) {
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  return `${dayNames[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function formatShortDate(date) {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

// "2 AM" on the hour or "2:30 AM" otherwise
function formatClock(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  let displayHour = hours % 12;
  if (displayHour === 0) displayHour = 12;

  if (minutes === 0) return `${displayHour} ${suffix}`;
  return `${displayHour}:${pad(minutes)} ${suffix}`;
}

function formatRangeSummary(start, end, isAllDay) {
  if (!start) return null;

  if (isAllDay) {
    if (end && !isSameDay(start, end)) {
      return `${formatShortDate(start)} – ${formatShortDate(end)} · All day`;
    }
    return `${formatShortDate(start)} · All day`;
  }

  if (end && !isSameDay(start, end)) {
    return `${formatShortDate(start)}, ${formatClock(start)} – ${formatShortDate(
      end
    )}, ${formatClock(end)}`;
  }

  if (end) {
    return `${formatShortDate(start)}, ${formatClock(start)} – ${formatClock(end)}`;
  }

  return `${formatShortDate(start)}, ${formatClock(start)}`;
}


// Accepts "7", "7pm", "7:30 pm", "19:30", "1930", "730"
// Without am/pm it stays in whichever half of the day the field is already in
// Returns a Date on the reference day or null when it can't be read
function parseTypedTime(text, reference) {
  const trimmed = String(text || "").trim().toLowerCase().replace(/\./g, "");
  if (!trimmed) return null;

  let body = trimmed;
  let meridiem = null;

  const meridiemMatch = body.match(/(am|pm|a|p)$/);
  if (meridiemMatch) {
    meridiem = meridiemMatch[1][0];
    body = body.slice(0, body.length - meridiemMatch[1].length).trim();
  }

  let hour = null;
  let minute = 0;

  const colon = body.match(/^(\d{1,2}):(\d{2})$/);
  const bare = body.match(/^(\d{1,2})$/);
  const compact = body.match(/^(\d{3,4})$/);

  if (colon) {
    hour = parseInt(colon[1], 10);
    minute = parseInt(colon[2], 10);
  } else if (bare) {
    hour = parseInt(bare[1], 10);
  } else if (compact) {
    const digits = compact[1];
    hour = parseInt(digits.slice(0, digits.length - 2), 10);
    minute = parseInt(digits.slice(-2), 10);
  } else {
    return null;
  }

  if (minute > 59) return null;

  if (meridiem === "a") {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
  } else if (meridiem === "p") {
    if (hour < 1 || hour > 12) return null;
    if (hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  } else if (hour <= 12) {
    // No am/pm typed, so keep the half of the day the field is already in
    const referenceIsPm = reference.getHours() >= 12;
    if (hour === 12) {
      hour = referenceIsPm ? 12 : 0;
    } else if (referenceIsPm) {
      hour += 12;
    }
  }

  const result = new Date(reference);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

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

function DateTimeSheet({
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
            width={68}
          />

          <WheelColumn
            items={MINUTE_ITEMS}
            selectedIndex={Math.round(target.getMinutes() / 5) % 12}
            onChange={(index) => handleWheelChange("minute", index)}
            width={68}
          />

          <WheelColumn
            items={MERIDIEM_ITEMS}
            selectedIndex={target.getHours() >= 12 ? 1 : 0}
            onChange={(index) => handleWheelChange("meridiem", index)}
            width={72}
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

/* ------------------------------------------------------------------
 * Create / Edit event screen
 * Pass `route.params.eventToEdit` (a full event row) to open this in
 * edit mode — the form pre-fills and the save button updates that row
 * instead of inserting a new one. Leave it out to create a new event
 * like before.
 * ---------------------------------------------------------------- */

export default function PostcardCreateEventScreen({ navigation, route }) {
  const eventToEdit = route?.params?.eventToEdit;
  const isEditMode = Boolean(eventToEdit?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [startDatetime, setStartDatetime] = useState(null);
  const [endDatetime, setEndDatetime] = useState(null);
  const [isAllDay, setIsAllDay] = useState(false);

  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [hostProfile, setHostProfile] = useState(null);

  // pre-fill the form when opened in edit mode
  useEffect(() => {
    if (!eventToEdit) return;

    setTitle(eventToEdit.title ?? "");
    setDescription(eventToEdit.description ?? "");
    setLocation(eventToEdit.location ?? "");
    setStartDatetime(
      eventToEdit.start_datetime ? new Date(eventToEdit.start_datetime) : null
    );
    setEndDatetime(
      eventToEdit.end_datetime ? new Date(eventToEdit.end_datetime) : null
    );
    setIsAllDay(Boolean(eventToEdit.is_all_day));
  }, [eventToEdit]);

  useEffect(() => {
    const fetchHostProfile = async () => {
      try {
        // in edit mode show the event's actual host, not necessarily
        // whoever is currently logged in and tapping "edit"
        if (isEditMode && eventToEdit?.host) {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, userName, avatar")
            .eq("id", eventToEdit.host)
            .single();

          if (error) {
            console.error("Error fetching host profile:", error);
            return;
          }

          setHostProfile(data);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("id, userName, avatar")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching host profile:", error);
          return;
        }

        setHostProfile(data);
      } catch (error) {
        console.error("Unexpected error fetching host profile:", error);
      }
    };

    fetchHostProfile();
  }, [isEditMode, eventToEdit?.host]);

  function applyPreset(preset) {
    const now = new Date();
    const roundedTime = roundUpToHalfHour(now);

    let baseDay = now;
    if (preset === "tomorrow") baseDay = addDays(now, 1);
    if (preset === "weekend") baseDay = getUpcomingWeekend(now);

    if (isAllDay) {
      setStartDatetime(startOfDay(baseDay));
      setEndDatetime(endOfDay(baseDay));
    } else {
      const nextStart = new Date(baseDay);
      nextStart.setHours(roundedTime.getHours(), roundedTime.getMinutes(), 0, 0);
      setStartDatetime(nextStart);
      setEndDatetime(new Date(nextStart.getTime() + HOUR_IN_MS));
    }
  }

  function handleSheetConfirm({ start, end, isAllDay: nextAllDay }) {
    setStartDatetime(start);
    setEndDatetime(end);
    setIsAllDay(nextAllDay);
    setIsSheetVisible(false);
  }

  const canCreate =
    title.trim().length > 0 && location.trim().length > 0 && Boolean(startDatetime);

  
  async function upsertHostInvite(eventId, userId) {
    const { data: existing, error: lookupError } = await supabase
      .from("invited")
      .select("id")
      .eq("event", eventId)
      .eq("user", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("Error checking invited row:", lookupError);
    }

    // check first, then update or insert
    if (existing) {
      const { error: updateError } = await supabase
        .from("invited")
        .update({ role: "host", status: "attending" })
        .eq("id", existing.id);

      if (updateError) console.error("Error updating host invite:", updateError);
      return;
    }

    const { error: insertError } = await supabase.from("invited").insert({
      event: eventId,
      user: userId,
      role: "host",
      status: "attending",
    });

    if (insertError && insertError.code !== "23505") {
      console.error("Error adding host to invited:", insertError);
    }
  }

  async function handleCreateEvent() {
    if (!canCreate || isSaving) return;

    setIsSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Sign in required", "Sign in again to create an event.");
        setIsSaving(false);
        return;
      }

      // EDIT MODE — update the existing row instead of inserting a new one.
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("events")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            start_datetime: toLocalTimestamp(startDatetime),
            end_datetime: endDatetime ? toLocalTimestamp(endDatetime) : null,
            is_all_day: isAllDay,
            location: location.trim(),
          })
          .eq("id", eventToEdit.id);

        if (updateError) {
          console.error("Error updating event:", updateError);
          Alert.alert("Event not updated", "Something went wrong. Try again.");
          setIsSaving(false);
          return;
        }

        if (typeof route?.params?.onSaved === "function") {
          route.params.onSaved();
        }

        navigation.goBack();
        return;
      }

      // CREATE MODE
      const { data: createdEvent, error: eventError } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          start_datetime: toLocalTimestamp(startDatetime),
          end_datetime: endDatetime ? toLocalTimestamp(endDatetime) : null,
          is_all_day: isAllDay,
          location: location.trim(),
          host: user.id,
        })
        .select()
        .single();

      if (eventError) {
        console.error("Error creating event:", eventError);
        Alert.alert("Event not created", "Something went wrong. Try again.");
        setIsSaving(false);
        return;
      }

      await upsertHostInvite(createdEvent.id, user.id);

      if (typeof route?.params?.onCreated === "function") {
        route.params.onCreated();
      }

      navigation.goBack();
    } catch (error) {
      console.error("Unexpected error creating event:", error);
      Alert.alert(
        isEditMode ? "Event not updated" : "Event not created",
        "Something went wrong. Try again."
      );
      setIsSaving(false);
    }
  }

  const rangeSummary = formatRangeSummary(startDatetime, endDatetime, isAllDay);
  const activePreset = derivePreset(startDatetime);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={32} color="#000000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEditMode ? "Edit Hangout" : "New Hangout"}
        </Text>
      </View>

      <View style={styles.headerDivider} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>WHAT?</Text>

          <TextInput
            style={styles.textField}
            value={title}
            onChangeText={setTitle}
            placeholder="What are we doing?"
            placeholderTextColor="#8E8E93"
          />

          <TextInput
            style={[styles.textField, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a few details (optional)"
            placeholderTextColor="#8E8E93"
            multiline
          />

          <Text style={styles.sectionLabel}>WHEN?</Text>

          <View style={styles.presetRow}>
            {[
              { key: "today", label: "Today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "weekend", label: "Weekend" },
              { key: "later", label: "Later" },
            ].map((preset) => {
              const selected = activePreset === preset.key;

              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.presetPill, selected && styles.presetPillActive]}
                  onPress={() =>
                    preset.key === "later"
                      ? setIsSheetVisible(true)
                      : applyPreset(preset.key)
                  }
                >
                  <Text
                    style={[styles.presetText, selected && styles.presetTextActive]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setIsSheetVisible(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color="#8E8E93"
              style={styles.pickerIcon}
            />
            <Text
              style={[styles.pickerText, rangeSummary && styles.pickerTextFilled]}
            >
              {rangeSummary || "Date & Time"}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>WHERE TO?</Text>

          <View style={styles.locationField}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#8E8E93"
              style={styles.pickerIcon}
            />
            <TextInput
              style={styles.locationInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Location"
              placeholderTextColor="#8E8E93"
            />
          </View>

          <Text style={styles.sectionLabel}>WHO'S COMING?</Text>

          <View style={styles.attendeeCard}>
            <View style={styles.avatarStack}>
              {hostProfile?.avatar ? (
                <Image
                  source={{ uri: hostProfile.avatar }}
                  style={styles.stackedAvatar}
                />
              ) : (
                <View style={[styles.stackedAvatar, styles.avatarPlaceholder]} />
              )}
            </View>

            <Text style={styles.attendeeSummary}>
              {hostProfile?.userName
                ? `Hosting as ${hostProfile.userName}`
                : "Hosting this hangout"}
            </Text>

            {/* Inviting more people from the edit flow would need its own
                UI (a picker over existing "invited" rows) — skipping that
                button in edit mode for now rather than showing something
                that doesn't do anything yet. */}
            {!isEditMode && (
              <TouchableOpacity style={styles.inviteButton} onPress={() => {}}>
                <Text style={styles.inviteButtonText}>Invite More People</Text>
                <Ionicons name="paper-plane-outline" size={18} color="#2F87F5" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
            onPress={handleCreateEvent}
            disabled={!canCreate || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.createButtonText,
                  !canCreate && styles.createButtonTextDisabled,
                ]}
              >
                {isEditMode ? "Save changes" : "Create event"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DateTimeSheet
        visible={isSheetVisible}
        initialStart={startDatetime}
        initialEnd={endDatetime}
        initialAllDay={isAllDay}
        onCancel={() => setIsSheetVisible(false)}
        onConfirm={handleSheetConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerBack: {
    position: "absolute",
    left: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D1D6",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
    marginTop: 20,
    marginBottom: 8,
  },

  textField: {
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 17,
    color: "#000000",
    marginBottom: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#F2F2F6",
  },
  presetPillActive: {
    backgroundColor: "#2F87F5",
  },
  presetText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3C3C43",
  },
  presetTextActive: {
    color: "#FFFFFF",
  },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerIcon: {
    marginRight: 8,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: "#8E8E93",
  },
  pickerTextFilled: {
    color: "#000000",
    fontWeight: "600",
  },

  locationField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 4,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: "#000000",
  },

  attendeeCard: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 14,
    padding: 14,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  stackedAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#E5E5EA",
  },
  overlappingAvatar: {
    marginLeft: -8,
  },
  avatarPlaceholder: {
    backgroundColor: "#D1D1D6",
  },
  attendeeSummary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3C3C43",
    marginBottom: 12,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#2F87F5",
    borderRadius: 10,
    paddingVertical: 12,
  },
  inviteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2F87F5",
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  createButton: {
    backgroundColor: "#2F87F5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#E5E5EA",
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  createButtonTextDisabled: {
    color: "#8E8E93",
  },

  // Date & time sheet
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