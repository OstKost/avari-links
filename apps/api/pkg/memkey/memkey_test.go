package memkey

import (
	"regexp"
	"testing"
)

func TestGenerateKey(t *testing.T) {
	keyPattern := regexp.MustCompile(`^[a-z0-9]+-[a-z0-9]+-\d{4}$`)

	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		key, err := Generate()
		if err != nil {
			t.Fatalf("Generate() error: %v", err)
		}

		if !keyPattern.MatchString(key) {
			t.Errorf("Generated key %q does not match expected format <word>-<word>-<4digits>", key)
		}

		if seen[key] {
			t.Errorf("Collision detected for key: %s", key)
		}
		seen[key] = true
	}
}

func TestDictionaries(t *testing.T) {
	if len(adjectives) < 50 {
		t.Errorf("expected at least 50 adjectives, got %d", len(adjectives))
	}
	if len(nouns) < 50 {
		t.Errorf("expected at least 50 nouns, got %d", len(nouns))
	}

	checkUniq := func(name string, list []string) {
		seen := make(map[string]bool)
		for _, w := range list {
			if seen[w] {
				t.Errorf("duplicate word in %s: %s", name, w)
			}
			seen[w] = true
		}
	}
	checkUniq("adjectives", adjectives)
	checkUniq("nouns", nouns)
}

func TestNormalizeAndHash(t *testing.T) {
	raw := "  Cosmic-Totoro-4081  "
	normalized := Normalize(raw)
	expectedNorm := "cosmic-totoro-4081"
	if normalized != expectedNorm {
		t.Errorf("expected %q, got %q", expectedNorm, normalized)
	}

	hash1 := Hash(raw)
	hash2 := Hash(expectedNorm)
	if hash1 != hash2 {
		t.Errorf("hashes must match: %s != %s", hash1, hash2)
	}

	if len(hash1) != 64 {
		t.Errorf("expected 64 hex chars SHA-256, got %d", len(hash1))
	}
}
