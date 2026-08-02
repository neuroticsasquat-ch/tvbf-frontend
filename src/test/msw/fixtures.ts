import type {
  CastMember,
  CrewMember,
  GenreOut,
  NetworkOut,
  PersonCredits,
  PersonOut,
  ShowDetail,
  ShowListPage,
  SeasonOut,
  EpisodeOut,
} from "@/api/types";

export const fixtureGenres: GenreOut[] = [
  { id: 1, name: "Drama" },
  { id: 2, name: "Comedy" },
  { id: 3, name: "Sci-Fi" },
];

export const fixtureNetworks: NetworkOut[] = [
  {
    id: 10,
    name: "HBO",
    country_code: "US",
    country_name: "United States",
    timezone: "America/New_York",
  },
  {
    id: 11,
    name: "BBC One",
    country_code: "GB",
    country_name: "United Kingdom",
    timezone: "Europe/London",
  },
];

export const fixtureShow: ShowDetail = {
  id: 100,
  name: "Fixture Show",
  type: "Scripted",
  status: "Running",
  language: "English",
  premiered: "2020-01-01",
  ended: null,
  image_medium: "https://example.com/m.jpg",
  image_original: "https://example.com/o.jpg",
  network: { id: 10, name: "HBO" },
  web_channel: null,
  genres: ["Drama"],
  matched_aka: null,
  rating_average: 8.4,
  my_rating: null,
  summary: "<p>A <b>test</b> show.</p>",
  runtime: 60,
  official_site: "https://example.com/show",
  externals: { imdb: "tt1234567", tvdb: 123, tvrage: null },
  tvmaze_updated: 1700000000,
  seasons: [
    {
      id: 1000,
      number: 1,
      name: null,
      episode_order: 10,
      premiere_date: "2020-01-01",
      end_date: "2020-03-01",
      network: null,
      web_channel: null,
      image_medium: null,
      image_original: null,
      summary: null,
    },
    {
      id: 1001,
      number: 2,
      name: null,
      episode_order: 10,
      premiere_date: "2021-01-01",
      end_date: "2021-03-01",
      network: null,
      web_channel: null,
      image_medium: null,
      image_original: null,
      summary: null,
    },
  ],
};

export const fixtureShowListPage: ShowListPage = {
  items: [
    {
      id: 100,
      name: "Fixture Show",
      type: "Scripted",
      status: "Running",
      language: "English",
      premiered: "2020-01-01",
      ended: null,
      image_medium: "https://example.com/m.jpg",
      image_original: "https://example.com/o.jpg",
      network: { id: 10, name: "HBO" },
      web_channel: null,
      genres: ["Drama"],
      matched_aka: null,
      rating_average: 8.4,
      my_rating: null,
    },
    {
      id: 101,
      name: "Another Show",
      type: "Scripted",
      status: "Ended",
      language: "English",
      premiered: "2015-01-01",
      ended: "2018-12-31",
      image_medium: null,
      image_original: null,
      network: { id: 11, name: "BBC One" },
      web_channel: null,
      genres: ["Comedy"],
      matched_aka: null,
      rating_average: null,
      my_rating: null,
    },
  ],
  page: 1,
  per_page: 50,
  total: 2,
  total_pages: 1,
};

export const fixtureEpisodes: EpisodeOut[] = [
  {
    id: 5000,
    show_id: 100,
    season_id: 1000,
    season: 1,
    number: 1,
    name: "Pilot",
    airdate: "2020-01-01",
    airtime: "21:00",
    runtime: 60,
    summary: "<p>Opening episode.</p>",
    image_medium: null,
    image_original: null,
    watched: false,
    rating_average: 8.4,
    my_rating: null,
  },
  {
    id: 5001,
    show_id: 100,
    season_id: 1000,
    season: 1,
    number: 2,
    name: "Second",
    airdate: "2020-01-08",
    airtime: "21:00",
    runtime: 60,
    summary: null,
    image_medium: null,
    image_original: null,
    watched: false,
    rating_average: null,
    my_rating: null,
  },
];

export const fixtureSeason2Episodes: EpisodeOut[] = [
  {
    id: 5100,
    show_id: 100,
    season_id: 1001,
    season: 2,
    number: 1,
    name: "S2 Pilot",
    airdate: "2021-01-01",
    airtime: "21:00",
    runtime: 60,
    summary: null,
    image_medium: null,
    image_original: null,
    watched: false,
    rating_average: null,
    my_rating: null,
  },
];

export const _seasonPlaceholder: SeasonOut[] = [];

// Deliberately NOT alphabetical: billing order comes from the API's
// `sort_order`, and the tests assert the rendered order matches it rather than
// a client-side sort.
export const fixtureCast: CastMember[] = [
  {
    person: { id: 1, name: "Zoe Lead", image_medium: "https://example.com/zoe.jpg" },
    character: { id: 11, name: "Captain Alpha", image_medium: null },
    self: false,
    voice: false,
  },
  {
    person: { id: 2, name: "Adam Second", image_medium: null },
    character: { id: 12, name: "Doctor Beta", image_medium: null },
    self: false,
    voice: true,
  },
  {
    person: { id: 3, name: "Mia Third", image_medium: "https://example.com/mia.jpg" },
    character: { id: 13, name: "Mia Third", image_medium: null },
    self: true,
    voice: false,
  },
];

export const fixtureCrew: CrewMember[] = [
  {
    person: { id: 4, name: "Wes Creator", image_medium: null },
    role: "Creator",
  },
  {
    person: { id: 5, name: "Ada Producer", image_medium: null },
    role: "Executive Producer",
  },
  {
    person: { id: 6, name: "Bo Producer", image_medium: null },
    role: "Executive Producer",
  },
  { person: { id: 7, name: "Cy Writer", image_medium: null }, role: "Writer" },
  { person: { id: 8, name: "Di Director", image_medium: null }, role: "Director" },
  { person: { id: 9, name: "Eve Composer", image_medium: null }, role: "Composer" },
];

export const fixturePerson: PersonOut = {
  id: 300,
  name: "Zoe Lead",
  country_code: "HR",
  country_name: "Croatia",
  birthday: "1972-09-09",
  deathday: null,
  gender: "Female",
  image_medium: "https://example.com/zoe-m.jpg",
  image_original: "https://example.com/zoe-o.jpg",
};

/** All three credit kinds populated, in the order the API serves them. */
export const fixturePersonCredits: PersonCredits = {
  cast: [
    {
      show: { id: 100, name: "Alpha Show", image_medium: null, premiered: "2020-01-01" },
      character: { id: 11, name: "Captain Alpha", image_medium: null },
      self: false,
      voice: false,
    },
    {
      show: { id: 101, name: "Beta Show", image_medium: null, premiered: "2015-06-01" },
      character: { id: 12, name: "Doctor Beta", image_medium: null },
      self: false,
      voice: true,
    },
  ],
  crew: [
    {
      show: { id: 100, name: "Alpha Show", image_medium: null, premiered: "2020-01-01" },
      role: "Executive Producer",
    },
  ],
  guest_cast: [
    {
      show: { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" },
      episode: {
        id: 900,
        name: "The Reckoning",
        season: 2,
        number: 11,
        airdate: "2019-04-02",
      },
      character: { id: 13, name: "Guest Of The Week", image_medium: null },
      self: false,
      voice: false,
    },
    {
      // A special: upstream leaves these unnumbered, so the code renders "S1".
      show: { id: 103, name: "Delta Show", image_medium: null, premiered: null },
      episode: { id: 901, name: null, season: 1, number: null, airdate: null },
      character: { id: 14, name: "Herself", image_medium: null },
      self: true,
      voice: false,
    },
  ],
};
