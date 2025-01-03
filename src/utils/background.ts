import overUnder from "../assets/backgrounds/over-under.png";
import overUnderSkills from "../assets/backgrounds/over-under-skills.png";
import highStakes from "../assets/backgrounds/high-stakes.png";
import highStakesSkills from "../assets/backgrounds/high-stakes-skills.png";
import defaultBackground from "../assets/backgrounds/default.png";

export type Background =
  | "over-under"
  | "over-under-skills"
  | "high-stakes"
  | "high-stakes-skills"
  | "default";

export const backgrounds: { [key in Background]: string } = {
  "high-stakes": highStakes,
  "high-stakes-skills": highStakesSkills,
  "over-under": overUnder,
  "over-under-skills": overUnderSkills,
  default: defaultBackground,
};
