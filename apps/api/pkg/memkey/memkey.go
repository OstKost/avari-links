package memkey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

var adjectives = []string{
	// Colors & Light
	"golden", "neon", "amber", "ruby", "emerald", "sapphire", "cobalt", "crimson",
	"silver", "violet", "scarlet", "azure", "coral", "indigo", "topaz", "jade",
	"opal", "bronze", "pearl", "obsidian", "copper", "velvet", "radiant", "vivid",
	"shining", "glowing", "luminous", "blazing", "sparkling", "gleaming", "ivory",
	"onyx", "sunset", "sunny",
	// Cosmic, Astro & Nature
	"cosmic", "solar", "lunar", "astral", "stellar", "nebula", "zenith", "aurora",
	"pulsar", "chrono", "gravity", "vortex", "spectral", "glacier", "polar", "frosty",
	"oceanic", "breeze", "storm", "volcanic", "thunder", "twilight", "horizon", "alpine",
	"arctic", "canyon", "tidal", "island", "forest", "meadow", "river", "delta",
	// Tech & Sci-Fi
	"cyber", "quantum", "atomic", "electric", "plasma", "kinetic", "dynamo", "vector",
	"sonic", "turbo", "hyper", "digital", "matrix", "pixel", "nano", "laser",
	"crypto", "synth", "glitch", "techno", "circuit", "flux", "warp", "binary",
	"optic", "alpha", "omega", "prime", "mega", "giga", "ultra",
	// Character & Qualities
	"stealth", "silent", "flying", "mystic", "epic", "clever", "gentle", "iron",
	"shadow", "brave", "wild", "swift", "crystal", "hidden", "ancient", "future",
	"noble", "magic", "phantom", "infinite", "blitz", "lucky", "mighty", "rapid",
	"bold", "bright", "keen", "nimble", "grand", "calm", "fierce", "chill",
	"lucid", "serene", "valiant", "sublime", "daring", "agile", "heroic", "witty",
	"fearless", "legend", "vibrant", "dynamic", "mysterious", "curious", "groovy", "crafty",
	"nova", "zen", "sparky", "astro", "cozy", "happy", "proud", "steady",
	"dapper", "snazzy", "breezy", "funky", "speedy", "zesty", "fuzzy", "slick",
}

var nouns = []string{
	// Anime & Pop Culture Characters
	"totoro", "pikachu", "naruto", "goku", "luffy", "mononoke", "howl", "chihiro",
	"calcifer", "chopper", "zoro", "levi", "eren", "tanjiro", "nezuko", "gojo",
	"sukuna", "sailormoon", "edward", "alphonse", "spike", "faye", "shinji", "asuka",
	"sherlock", "gandalf", "frodo", "aragorn", "legolas", "yoda", "luke", "vader",
	"mandalorian", "grogu", "neo", "morpheus", "trinity", "batman", "joker", "spock",
	"kirk", "walter", "jesse", "geralt", "ciri", "yennefer", "shrek", "donkey",
	"rocky", "terminator", "blade", "johnwick", "doctorwho", "marty", "docbrown",
	"mario", "luigi", "zelda", "link", "kirby", "samus", "cloud", "sephiroth",
	// Animals & Wildlife
	"capybara", "raccoon", "fox", "otter", "corgi", "dragon", "penguin", "falcon",
	"badger", "cheshire", "panda", "koala", "lynx", "wolf", "owl", "redpanda",
	"hedgehog", "beaver", "seal", "walrus", "tiger", "panther", "gecko", "chameleon",
	"lemur", "quokka", "axolotl", "narwhal", "orca", "dolphin", "phoenix", "griffin",
	"jaguar", "leopard", "cheetah", "husky", "shiba", "bear", "moose", "bison",
	"eagle", "hawk", "raven", "sparrow", "robin", "hummingbird", "heron", "crane",
	"mantis", "beetle", "firefly", "dragonfly", "octopus", "squid", "stingray", "jellyfish",
	"whale", "mammoth", "sloth", "llama", "alpaca", "ferret", "meerkat", "mongoose",
	"rhino", "hippo", "zebra", "giraffe", "kangaroo", "platypus", "pelican", "toucan",
	"flamingo", "crow", "condor", "swan", "finch",
	// Artifacts, Celestial & Tech
	"cookie", "portal", "katana", "wand", "beacon", "shield", "potion", "scroll",
	"cipher", "voyage", "pulse", "quasar", "relic", "drift", "compass", "lantern",
	"orbit", "nexus", "amulet", "prism", "chalice", "totem", "orb", "anchor",
	"astrolabe", "tome", "sigil", "feather", "helmet", "gauntlet", "ring", "crown",
	"monolith", "capsule", "starship", "radar", "glider", "rocket", "dagger",
	"saber", "staff", "comet", "meteor", "rover", "spark", "asteroid", "satellite",
	"oasis", "temple", "pyramid", "citadel", "haven", "harbor",
}

// Generate produces a memorable, secure, high-entropy key combining:
// <adjective>-<noun>-<4-digit number>
// e.g. "cosmic-totoro-4081"
func Generate() (string, error) {
	adjIdx, err := randInt(len(adjectives))
	if err != nil {
		return "", err
	}
	nounIdx, err := randInt(len(nouns))
	if err != nil {
		return "", err
	}
	// 4 digits: 1000..9999
	num, err := randRange(1000, 9999)
	if err != nil {
		return "", err
	}

	key := fmt.Sprintf("%s-%s-%d", adjectives[adjIdx], nouns[nounIdx], num)
	return key, nil
}

// Normalize cleans up a user-provided key for consistent hashing and comparisons.
func Normalize(rawKey string) string {
	return strings.ToLower(strings.TrimSpace(rawKey))
}

// Hash produces a SHA-256 hex string suitable for database storage and index lookup.
func Hash(rawKey string) string {
	normalized := Normalize(rawKey)
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

func randInt(max int) (int, error) {
	if max <= 0 {
		return 0, fmt.Errorf("max must be positive")
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}

func randRange(min, max int) (int, error) {
	if min >= max {
		return min, nil
	}
	delta := max - min + 1
	n, err := randInt(delta)
	if err != nil {
		return 0, err
	}
	return min + n, nil
}
