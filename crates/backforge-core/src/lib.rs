pub mod error;
pub mod project;
pub mod manager;

pub use error::{CoreError, CoreResult};
pub use project::state::ProjectState;
pub use manager::ProjectManager;
