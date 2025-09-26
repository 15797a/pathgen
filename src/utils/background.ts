import overUnder from "../assets/backgrounds/over-under.png";
import overUnderSkills from "../assets/backgrounds/over-under-skills.png";
import highStakes from "../assets/backgrounds/high-stakes.png";
import highStakesSkills from "../assets/backgrounds/high-stakes-skills.png";
import pushBack from "../assets/backgrounds/push-back.png";
import pushBackSkills from "../assets/backgrounds/push-back-skills.png";
import defaultBackground from "../assets/backgrounds/default.png";

export type Background =
  | "over-under"
  | "over-under-skills"
  | "high-stakes"
  | "high-stakes-skills"
	| "push-back"
	| "push-back-skills"
  | "default";

export const backgrounds: { [key in Background]: string } = {
  "high-stakes": highStakes,
  "high-stakes-skills": highStakesSkills,
  "over-under": overUnder,
  "over-under-skills": overUnderSkills,
	"push-back": pushBack,
	"push-back-skills": pushBackSkills,
  default: defaultBackground,
};
