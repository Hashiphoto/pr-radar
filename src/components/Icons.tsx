import {
  ArrowDown,
  ArrowUp,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Copy,
  EyeOff,
  GitBranch,
  GitPullRequest,
  GitPullRequestDraft,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Settings,
  Star,
  Sun,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
  CircleQuestionMark,
  type LucideIcon,
} from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

// Even sizes only. These are drawn on a 24 unit grid, and an odd pixel size lands the strokes on
// half pixels, which the refresh icon shows up as a wobble the moment it starts spinning.
const icon = (Glyph: LucideIcon, defaultSize = 16) => {
  const Icon = ({ size = defaultSize, className }: IconProps) => (
    <Glyph size={size} className={className} aria-hidden />
  );
  Icon.displayName = Glyph.displayName;
  return Icon;
};

export const RefreshIcon = icon(RefreshCw);
export const GearIcon = icon(Settings);
export const CloseIcon = icon(X);
export const MuteIcon = icon(EyeOff);
export const UndoIcon = icon(Undo2);
export const ChevronIcon = icon(ChevronDown);
export const SunIcon = icon(Sun);
export const MoonIcon = icon(Moon);
export const BranchIcon = icon(GitBranch);
export const PlusIcon = icon(Plus);
export const ArrowUpIcon = icon(ArrowUp);
export const ArrowDownIcon = icon(ArrowDown);
export const BellIcon = icon(Bell);
export const CopyIcon = icon(Copy);
export const CheckIcon = icon(Check);
export const GroupsIcon = icon(Rows3, 14);
export const PrOpenIcon = icon(GitPullRequest);
export const PrDraftIcon = icon(GitPullRequestDraft);
export const ConflictIcon = icon(TriangleAlert, 14);
export const HelpIcon = icon(CircleQuestionMark);
export const TrashIcon = icon(Trash2);
export const PencilIcon = icon(Pencil, 13);
export const BellOffIcon = icon(BellOff);

// The only icon with two states: a starred author is filled, everyone else gets the outline.
export const StarIcon = ({ size = 16, className, filled = false }: IconProps & { filled?: boolean }) => (
  <Star size={size} className={className} aria-hidden fill={filled ? 'currentColor' : 'none'} />
);
