import {
  GBA_BUTTON_A,
  GBA_BUTTON_B,
  GBA_BUTTON_DOWN,
  GBA_BUTTON_L,
  GBA_BUTTON_LEFT,
  GBA_BUTTON_R,
  GBA_BUTTON_RIGHT,
  GBA_BUTTON_SELECT,
  GBA_BUTTON_START,
  GBA_BUTTON_UP
} from "./keyinput-states";

export function getButtons(value) {
  return {
    a: value & GBA_BUTTON_A,
    b: value & GBA_BUTTON_B,
    select: value & GBA_BUTTON_SELECT,
    start: value & GBA_BUTTON_START,
    right: value & GBA_BUTTON_RIGHT,
    left: value & GBA_BUTTON_LEFT,
    up: value & GBA_BUTTON_UP,
    down: value & GBA_BUTTON_DOWN,
    l: value & GBA_BUTTON_L,
    r: value & GBA_BUTTON_R
  };
}
