/* ---------------------------------------
    The embedder never accepts a connection, so it refuses to listen at all.
    Ported from Kinetic Markdown's security/listen-guard.mjs.
--------------------------------------- */

import { refuseListening } from './network-guard.ts';

refuseListening();
