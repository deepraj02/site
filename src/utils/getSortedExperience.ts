import type { CollectionEntry } from "astro:content";

const getSortedExperience = (experience: CollectionEntry<"experience">[]) =>
    experience
        .filter(({ data }) => !data.draft)
        .sort(
            (a, b) =>
                Math.floor(
                    (b.data.endDate ?? new Date()).getTime() / 1000,
                ) -
                Math.floor(
                    (a.data.endDate ?? new Date()).getTime() / 1000,
                ),
        );

export default getSortedExperience;
