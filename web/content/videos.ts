/**
 * Films intégrés aux fiches réalisations.
 *
 * Les vidéos ne passent pas par le back office : le catalogue ne transporte que
 * des images. Ce registre versionné associe un slug de fiche à ses films, servis
 * depuis /public/assets/video/<slug>/. Un fichier absent de ce registre n'affiche
 * aucun lecteur.
 *
 * Chaque film est proposé en MP4 (H.264/AAC, meilleure prise en charge matérielle)
 * puis en WebM (VP9/Opus) pour les navigateurs libres compilés sans H.264.
 */
export type ProjectVideo = {
  mp4: string;
  webm: string;
  poster: string;
  title: string;
  caption: string;
  width: number;
  height: number;
};

export const projectVideos: Record<string, ProjectVideo[]> = {
  "societe-generale-voeux-2018": [
    {
      mp4: "/assets/video/societe-generale-voeux-2018/claisse.mp4",
      webm: "/assets/video/societe-generale-voeux-2018/claisse.webm",
      poster: "/assets/img/projet/societe-generale-voeux-2018/01.jpg",
      title: "Geneviève Claisse, Cercles",
      caption: "Film de vœux 2018, 25 secondes, animation After Effects",
      width: 1280,
      height: 720,
    },
    {
      mp4: "/assets/video/societe-generale-voeux-2018/granet.mp4",
      webm: "/assets/video/societe-generale-voeux-2018/granet.webm",
      poster: "/assets/img/projet/societe-generale-voeux-2018/05.jpg",
      title: "Louis Granet, Sans titre",
      caption: "Film de vœux 2018, 25 secondes, animation After Effects",
      width: 1280,
      height: 720,
    },
  ],
};
