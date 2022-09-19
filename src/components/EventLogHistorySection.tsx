import { useState, useEffect } from "react";
import PropTypes from "extended-proptypes";
import { reverse } from "lodash/fp";
import moment from "moment";
import { BodyText, Caption, Subheading, Text } from "@classdojo/web/nessie";
import { XCircleIcon, ChevronDownIcon, ChevronUpIcon, HelpIcon } from "@classdojo/web/nessie/icons";
import { addOnEventsChangeHandler, flush } from "./eventRecorder";

import { RAW_cssValue } from "@classdojo/web/nessie/stylingLib";

const EventShape = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  timestamp: PropTypes.date.isRequired,
  details: PropTypes.object.isRequired,
});

export const EventLogHistorySectionContainer = () => {
  const [eventsLog, setEventsLog] = useState([]);

  // register on mount to update the events list whenever the app sends a new event
  useEffect(() => {
    return addOnEventsChangeHandler((events) => setEventsLog(reverse(events)));
  }, []);

  return <EventLogHistorySection eventsLog={eventsLog} clearEvents={flush} />;
};

const EventLogHistorySection = ({ eventsLog, clearEvents }) => {
  return (
    <div sx={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
      <div
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: "dt_s",
          position: "relative",
        }}
      >
        <div sx={{ flex: 1, position: "relative" }}>
          <Subheading flex="1">Logged Events</Subheading>
        </div>
        <div sx={{ position: "relative" }}>
          <XCircleIcon cursor="pointer" onClick={clearEvents} />
        </div>
      </div>
      <div sx={{ flex: 1, position: "relative" }}>
        {eventsLog.map((event) => {
          // highlight events logged in the last 5 seconds before this rendering cycle,
          // this will only update when the list gets re-rendered, so events will stay highlighted
          // for longer than 5 seconds, but that should be good enough for now
          const isRecentEvent = new Date() - event.timestamp < 5000;
          return <EventLogHistoryItem key={event._id} event={event} isRecentEvent={isRecentEvent} />;
        })}
      </div>
      <div
        sx={{
          marginTop: "dt_m",
          padding: "dt_xs",
          boxShadow: "dt_shadow_shadezies",
          border: "normal",
          display: "flex",
          flexDirection: "row",
          color: "dt_taro40",
          position: "relative",
        }}
      >
        <HelpIcon />
        <div sx={{ marginLeft: "dt_xs", position: "relative" }}>
          <Text>
            Toolkit runs inside an iframe, therefore we don't have access to logged events. If you need to see Toolkit
            events, open the network tab of your developer toolbar.
          </Text>
        </div>
      </div>
    </div>
  );
};
EventLogHistorySection.propTypes = {
  eventsLog: PropTypes.arrayOf(EventShape).isRequired,
  clearEvents: PropTypes.func.isRequired,
};

const EventLogHistoryItem = ({ event, isRecentEvent }) => {
  const [isShowingDetails, setIsShowingDetails] = useState(false);

  return (
    <div
      sx={{
        paddingTop: "dt_s",
        paddingBottom: "dt_s",
        borderBottom: "1px solid",
        borderColor: isRecentEvent ? "dt_kiwi50" : "dt_taro30",
        position: "relative",
      }}
    >
      <div sx={{ display: "flex", alignItems: "center", flexDirection: "row", position: "relative" }}>
        <div
          onClick={() => setIsShowingDetails((value) => !value)}
          sx={{ flex: 1, cursor: "pointer", position: "relative" }}
        >
          <Caption color="basalt">{moment(event.timestamp).from()}</Caption>
          <BodyText>{event.details.eventName}</BodyText>
          {event.details.eventValue ? (
            <div sx={{ display: "flex", flexDirection: "row", position: "relative" }}>
              <div sx={{ marginRight: "dt_xs", position: "relative" }}>
                <Caption color="basalt">value:</Caption>
              </div>
              <div sx={{ position: "relative" }}>
                <Caption color="capri">{event.details.eventValue}</Caption>
              </div>
            </div>
          ) : null}
        </div>
        <div sx={{ marginLeft: "dt_s", position: "relative" }}>
          <div sx={{ marginLeft: "dt_s", position: "relative" }}>
            {isShowingDetails ? <ChevronUpIcon size="s" /> : <ChevronDownIcon size="s" />}
          </div>
        </div>
      </div>
      {isShowingDetails ? (
        <div
          sx={{
            marginTop: "dt_s",
            paddingLeft: "dt_s",
            paddingRight: "dt_s",
            backgroundColor: "dt_taro10",
            border: "normal",
            borderRadius: RAW_cssValue("10px"),
            fontSize: "12px",
            position: "relative",
          }}
        >
          <pre>{JSON.stringify(event.details, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
};
EventLogHistoryItem.propTypes = {
  event: EventShape,
  isRecentEvent: PropTypes.bool,
};
