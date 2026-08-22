import { DEFAULT_HUE, HUE_MAX, HUE_MIN, normalizeHue } from '../../shared/hue.js';
import { hueStyle } from '../groups.js';
import { UndoIcon } from './Icons.js';

export interface HuePickerProps {
  hue: number | null;
  onChange: (hue: number | null) => void;
}

export const HuePicker = ({ hue, onChange }: HuePickerProps) => (
  <div className={`hue-picker${hue === null ? '' : ' is-tinted'}`} style={hueStyle(hue)}>
    <input
      type="range"
      className="hue-slider"
      min={HUE_MIN}
      max={HUE_MAX}
      value={hue ?? DEFAULT_HUE}
      aria-label="Group color"
      title="Pick this group's color"
      onChange={(event) => onChange(normalizeHue(Number(event.target.value)))}
    />

    <input
      type="number"
      className="text-input is-hue-value"
      min={HUE_MIN}
      max={HUE_MAX}
      value={hue ?? ''}
      placeholder="—"
      aria-label="Group color, as a hue from 0 to 359"
      title="The hue this group is tinted with. Type one in to reuse an exact color."
      onChange={(event) =>
        onChange(event.target.value === '' ? null : normalizeHue(Number(event.target.value)))
      }
    />

    <button
      type="button"
      className="icon-button is-tiny-square"
      title="Use the default color"
      disabled={hue === null}
      onClick={() => onChange(null)}
    >
      <UndoIcon size={12} />
    </button>
  </div>
);
