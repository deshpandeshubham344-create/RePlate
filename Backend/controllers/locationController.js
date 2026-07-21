const axios = require("axios");

exports.searchLocation = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({
        message: "Search query is required.",
      });
    }

    const response = await axios.get(
      "https://api.openrouteservice.org/geocode/search",
      {
        params: {
          api_key: process.env.ORS_API_KEY,
          text: query,
          size: 5,
        },
      },
    );

    const places = response.data.features.map((place) => ({
      display_name: place.properties.label,

      lat: place.geometry.coordinates[1],

      lon: place.geometry.coordinates[0],
    }));

    res.json(places);
  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      message: "Failed to fetch locations.",
    });
  }
};