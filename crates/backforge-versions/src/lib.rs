pub mod error;
pub mod snapshot;
pub mod store;
pub mod diff;

pub use error::{VersionError, VersionResult};
pub use snapshot::{Snapshot, SnapshotMeta};
pub use store::VersionStore;
pub use diff::{StateDiff, FieldChange, TableChange, ChangeKind};
