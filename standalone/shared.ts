// Artifact build: what the lazily loaded charts bundle borrows from the page (one React, one counter).
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsx from "react/jsx-runtime";
import * as track from "../lib/track";

(window as unknown as { __snoopyShared: unknown }).__snoopyShared = { React, ReactDOM, jsx, track };
