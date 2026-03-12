use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Logical clock per node — implements vector-clock semantics.
/// Each entry is (node_id → counter).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct VectorClock(pub HashMap<String, u64>);

impl VectorClock {
    pub fn new() -> Self {
        Self(HashMap::new())
    }

    /// Increment the counter for this node.
    pub fn increment(&mut self, node_id: &str) {
        *self.0.entry(node_id.to_string()).or_insert(0) += 1;
    }

    /// Return the current counter for a node (0 if unseen).
    pub fn get(&self, node_id: &str) -> u64 {
        self.0.get(node_id).copied().unwrap_or(0)
    }

    /// Merge two clocks by taking the maximum per node.
    pub fn merge(&self, other: &VectorClock) -> VectorClock {
        let mut merged = self.0.clone();
        for (k, v) in &other.0 {
            let entry = merged.entry(k.clone()).or_insert(0);
            if *v > *entry {
                *entry = *v;
            }
        }
        VectorClock(merged)
    }

    /// Returns true if `self` dominates `other` (self ≥ other at all nodes
    /// AND strictly greater at at least one node).
    pub fn dominates(&self, other: &VectorClock) -> bool {
        // self must be >= other at every node other knows about
        let ge = other.0.iter().all(|(k, v)| self.get(k) >= *v);
        // and at least one node where self > other
        let strictly_greater = self.0.iter().any(|(k, v)| *v > other.get(k));
        ge && strictly_greater
    }

    /// Returns true if the two clocks are concurrent (neither dominates the other).
    pub fn concurrent(&self, other: &VectorClock) -> bool {
        !self.dominates(other) && !other.dominates(self) && self != other
    }

    /// Sorted key-value pairs for deterministic display / hashing.
    pub fn to_sorted_pairs(&self) -> Vec<(String, u64)> {
        let mut pairs: Vec<_> = self.0.iter().map(|(k, v)| (k.clone(), *v)).collect();
        pairs.sort_by(|a, b| a.0.cmp(&b.0));
        pairs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_increment_and_get() {
        let mut c = VectorClock::new();
        c.increment("node-a");
        c.increment("node-a");
        c.increment("node-b");
        assert_eq!(c.get("node-a"), 2);
        assert_eq!(c.get("node-b"), 1);
        assert_eq!(c.get("node-c"), 0);
    }

    #[test]
    fn test_merge_takes_max() {
        let mut a = VectorClock::new();
        a.increment("x");
        a.increment("x");
        a.increment("y");

        let mut b = VectorClock::new();
        b.increment("x");
        b.increment("z");

        let m = a.merge(&b);
        assert_eq!(m.get("x"), 2); // max(2, 1)
        assert_eq!(m.get("y"), 1); // only in a
        assert_eq!(m.get("z"), 1); // only in b
    }

    #[test]
    fn test_dominates() {
        let mut old = VectorClock::new();
        old.increment("a");

        let mut new = VectorClock::new();
        new.increment("a");
        new.increment("a");
        new.increment("b");

        assert!(new.dominates(&old));
        assert!(!old.dominates(&new));
    }

    #[test]
    fn test_concurrent() {
        let mut a = VectorClock::new();
        a.increment("node-a");

        let mut b = VectorClock::new();
        b.increment("node-b");

        assert!(a.concurrent(&b));
        assert!(b.concurrent(&a));
    }

    #[test]
    fn test_equal_not_concurrent() {
        let mut a = VectorClock::new();
        a.increment("x");
        let b = a.clone();
        assert!(!a.concurrent(&b));
    }

    #[test]
    fn test_serialization_roundtrip() {
        let mut c = VectorClock::new();
        c.increment("alpha");
        c.increment("beta");
        c.increment("alpha");
        let json = serde_json::to_string(&c).unwrap();
        let restored: VectorClock = serde_json::from_str(&json).unwrap();
        assert_eq!(c, restored);
    }
}
