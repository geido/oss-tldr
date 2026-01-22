interface User {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
}

const CURRENT_USER_KEY = "oss-tldr-current-user";

export class UserStorage {
  /**
   * Get a user-specific storage key
   */
  static getUserKey(baseKey: string, user: User | null): string {
    if (!user) return baseKey; // Fallback for non-authenticated state
    return `${baseKey}:${user.id}`;
  }

  /**
   * Check if the current user has changed and handle data cleanup
   */
  static handleUserChange(newUser: User | null): {
    userChanged: boolean;
    previousUser: User | null;
  } {
    try {
      const storedUserData = localStorage.getItem(CURRENT_USER_KEY);
      const previousUser = storedUserData ? JSON.parse(storedUserData) : null;

      const userChanged = this.hasUserChanged(previousUser, newUser);

      if (userChanged) {
        console.log("User changed, clearing old user data...", {
          from: previousUser?.login || "none",
          to: newUser?.login || "none",
        });

        // Clear all user-specific data for the previous user
        this.clearUserData(previousUser);
      }

      // Update current user
      if (newUser) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }

      return { userChanged, previousUser };
    } catch (error) {
      console.error("Failed to handle user change:", error);
      return { userChanged: false, previousUser: null };
    }
  }

  /**
   * Check if the user has actually changed (not just re-authenticated)
   */
  private static hasUserChanged(
    previousUser: User | null,
    newUser: User | null,
  ): boolean {
    // Both null/undefined - no change
    if (!previousUser && !newUser) return false;

    // One is null, other is not - user changed
    if (!previousUser || !newUser) return true;

    // Compare user IDs (most reliable identifier)
    return previousUser.id !== newUser.id;
  }

  /**
   * Clear all stored data for a specific user
   */
  private static clearUserData(user: User | null): void {
    if (!user) return;

    const userSuffix = `:${user.id}`;
    const keysToRemove: string[] = [];

    // Find all keys belonging to this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(userSuffix)) {
        keysToRemove.push(key);
      }
    }

    // Remove all user-specific keys
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      console.log(`Cleared user data: ${key}`);
    });
  }

  /**
   * Get current stored user
   */
  static getCurrentUser(): User | null {
    try {
      const storedUserData = localStorage.getItem(CURRENT_USER_KEY);
      return storedUserData ? JSON.parse(storedUserData) : null;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  }

  /**
   * Clear all data (for logout)
   */
  static clearAllData(): void {
    try {
      localStorage.clear();
      console.log("Cleared all localStorage data");
    } catch (error) {
      console.error("Failed to clear all data:", error);
    }
  }
}
