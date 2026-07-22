 
 //find happening now events
 import React, {  useMemo, useEffect, useState } from "react";

 export default function formatEventList() {
 const { happeningNow, upcoming } = useMemo(() => {
    const now = new Date();
    const isLive = (e) =>
      new Date(e.start_datetime) <= now && new Date(e.end_datetime) >= now;
  
    return {
      happeningNow: filteredEvents.filter(isLive),
      upcoming: filteredEvents.filter((e) => !isLive(e)),
    };
  }, [filteredEvents]);

    const sections = useMemo(() => {
    const groups = {};
    upcoming.forEach((event) => {
      const d = new Date(event.start_datetime);
      const key = d.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
 
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .map(([title, data]) => ({
        title,
        data: data.sort(
          (a, b) => new Date(b.start_datetime) - new Date(a.start_datetime)
        ),
      }));
  }, [upcoming]);

  const rightNow =  Date();
  console.log(rightNow); 
}