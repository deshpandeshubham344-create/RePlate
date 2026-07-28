const axios = require("axios");
exports.searchLocation = async (req, res) => {
  try {
    const { q, area } = req.query;
    if (!q) {
      return res.status(400).json({
        message: "Search query is required.",
      });
    }
    // If searching for a landmark, include the selected area
    const searchText = area ? `${q}, ${area}` : q;
    console.log("Search Text:", searchText);
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: searchText,
          format: "json",
          addressdetails: 1,
          limit: 5,
        },
        headers: {
          "User-Agent": "RePlate/1.0",
        },
      }
    );
    const places = response.data.map((place) => ({
      display_name: place.display_name,
      lat: place.lat,
      lon: place.lon,
    }));
    res.json(places);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      message: "Failed to fetch locations.",
    });
  }
};