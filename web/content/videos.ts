/**
 * Films intégrés aux fiches réalisations.
 *
 * Les vidéos ne passent pas par le back office : le catalogue ne transporte que
 * des images. Ce registre versionné associe un slug de fiche à ses films, servis
 * depuis /public/assets/video/<slug>/. Un fichier absent de ce registre n'affiche
 * aucun lecteur.
 */
export type ProjectVideo = {
  src: string;
  poster: string;
  title: string;
  caption: string;
  width: number;
  height: number;
};

export const projectVideos: Record<string, ProjectVideo[]> = {
  "societe-generale-voeux-2018": [
    {
      src: "/assets/video/societe-generale-voeux-2018/claisse.mp4",
      poster: "/assets/img/projet/societe-generale-voeux-2018/01.jpg",
      title: "Geneviève Claisse, Cercles",
      caption: "Film de vœux 2018, 25 secondes, animation After Effects",
      width: 1280,
      height: 720,
    },
    {
      src: "/assets/video/societe-generale-voeux-2018/granet.mp4",
      poster: "/assets/img/projet/societe-generale-voeux-2018/05.jpg",
      title: "Louis Granet, Sans titre",
      caption: "Film de vœux 2018, 25 secondes, animation After Effects",
      width: 1280,
      height: 720,
    },
  ],
};
