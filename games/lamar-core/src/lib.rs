const STATE_PLAYING: u32 = 1;
const STATE_PAUSED: u32 = 2;
const STATE_DEAD: u32 = 3;

const LAMAR_X: i32 = -45;
const LAMAR_PROJECTILE_X: i32 = 227;
const GOON_START_X: i32 = 605;

/// A fixed-step reconstruction of the state in the original `Game.java`.
///
/// This deliberately preserves legacy quirks. Do not "improve" frame pacing,
/// bounds, projectile travel, retry state, or collision rules here; those
/// belong in the separately tracked remaster.
struct Game {
    state: u32,
    difficulty: u32,
    player_y: i32,
    enemy_y: i32,
    enemy_offset: i32,
    projectile_roll: u32,
    enemy_projectile_offset: i32,
    enemy_projectile_x: i32,
    enemy_projectile_y: i32,
    enemy_projectile_active: bool,
    health: i32,
    max_health: i32,
    boost: i32,
    kills: i32,
    laser_visible: bool,
    laser_y: i32,
    laser_end_x: i32,
    accumulated_ms: f32,
    rng: u32,
}

impl Game {
    const fn new() -> Self {
        Self {
            state: STATE_PLAYING,
            difficulty: 1,
            player_y: 0,
            enemy_y: 166,
            enemy_offset: 0,
            projectile_roll: 3,
            enemy_projectile_offset: 0,
            enemy_projectile_x: 0,
            enemy_projectile_y: 0,
            enemy_projectile_active: false,
            health: 400,
            max_health: 400,
            boost: 0,
            kills: 0,
            laser_visible: false,
            laser_y: 200,
            laser_end_x: LAMAR_PROJECTILE_X,
            accumulated_ms: 0.0,
            rng: 0x4c41_4d41,
        }
    }

    fn reset(&mut self, difficulty: u32, seed: u32) {
        self.difficulty = difficulty.clamp(1, 3);
        self.max_health = match self.difficulty {
            1 => 400,
            2 => 200,
            _ => 100,
        };
        self.health = self.max_health;
        self.state = STATE_PLAYING;
        self.player_y = 0;
        self.enemy_offset = 0;
        self.enemy_projectile_offset = 0;
        self.enemy_projectile_x = 0;
        self.enemy_projectile_y = 0;
        self.enemy_projectile_active = false;
        self.boost = 0;
        self.kills = 0;
        self.laser_visible = false;
        self.laser_y = 200;
        self.laser_end_x = LAMAR_PROJECTILE_X;
        self.accumulated_ms = 0.0;
        self.rng = if seed == 0 { 0x4c41_4d41 } else { seed };
        self.enemy_y = self.random_enemy_y();
        self.projectile_roll = self.random_projectile_roll();
    }

    fn next_random(&mut self) -> u32 {
        let mut value = self.rng;
        value ^= value << 13;
        value ^= value >> 17;
        value ^= value << 5;
        self.rng = value;
        value
    }

    fn random_enemy_y(&mut self) -> i32 {
        (self.next_random() % 333) as i32
    }

    fn random_projectile_roll(&mut self) -> u32 {
        (self.next_random() % 3) + 1
    }

    fn enemy_x(&self) -> i32 {
        GOON_START_X - self.enemy_offset
    }

    fn wave_has_projectile(&self) -> bool {
        match self.difficulty {
            1 => self.projectile_roll == 1,
            2 => self.projectile_roll == 1 || self.projectile_roll == 2,
            _ => true,
        }
    }

    fn tick_duration_ms(&self) -> f32 {
        let sleep_ms = match self.difficulty {
            1 if self.wave_has_projectile() => 8,
            2 if self.wave_has_projectile() => 6,
            3 => 7,
            _ => 5,
        };
        sleep_ms as f32
    }

    fn update(&mut self, dt_seconds: f32) {
        if self.state != STATE_PLAYING {
            return;
        }

        self.accumulated_ms += dt_seconds.clamp(0.0, 0.25) * 1000.0;
        let mut ticks = 0;
        while self.state == STATE_PLAYING && ticks < 64 {
            let tick_ms = self.tick_duration_ms();
            if self.accumulated_ms < tick_ms {
                break;
            }
            self.accumulated_ms -= tick_ms;
            self.legacy_tick();
            ticks += 1;
        }
    }

    fn legacy_tick(&mut self) {
        if self.enemy_x() < -180 {
            self.health -= 20;
            self.enemy_y = self.random_enemy_y();
            self.enemy_offset = 0;
            self.projectile_roll = self.random_projectile_roll();
            // Game.java only reset this offset when the new random roll was 2.
            if self.projectile_roll == 2 {
                self.enemy_projectile_offset = 0;
            }
        }

        if self.boost == 25 {
            self.health += 50;
            self.boost = 0;
        }

        self.update_enemy_projectile();

        // The original only entered its death branch when xGoonProj > 0.
        if self.enemy_projectile_x > 0 {
            let relative_y = self.enemy_projectile_y - self.player_y;
            let projectile_hit =
                LAMAR_X + 190 >= self.enemy_projectile_x && relative_y < 255 && relative_y > 95;
            if self.health <= 0 || projectile_hit {
                self.state = STATE_DEAD;
                return;
            }
        }

        match self.difficulty {
            1 => self.enemy_offset += 4,
            2 => self.enemy_offset += 2 + self.kills,
            _ => {
                self.enemy_y = self.random_enemy_y();
                self.enemy_offset += 2 + self.kills;
            }
        }
    }

    fn update_enemy_projectile(&mut self) {
        if !self.wave_has_projectile() {
            self.enemy_projectile_x = 0;
            self.enemy_projectile_y = 0;
            self.enemy_projectile_active = false;
            return;
        }

        self.enemy_projectile_x = self.enemy_x() - 30 - self.enemy_projectile_offset;
        self.enemy_projectile_y = self.enemy_y + 75;
        self.enemy_projectile_active = true;
        self.enemy_projectile_offset += if self.difficulty == 1 { 1 } else { 2 };
    }

    fn nudge_player(&mut self, direction: i32) {
        if self.state == STATE_PLAYING {
            self.player_y += 15 * direction.signum();
        }
    }

    fn register_input(&mut self) {
        if self.state == STATE_PLAYING {
            // This increment lived inside the original input loop and occurred
            // for every character, whether or not the key had a game action.
            self.enemy_offset += 3;
        }
    }

    fn fire(&mut self) {
        if self.state != STATE_PLAYING {
            return;
        }

        self.laser_visible = true;
        self.laser_y = self.player_y + 200;
        self.laser_end_x = LAMAR_PROJECTILE_X;

        let enemy_x = self.enemy_x();
        let mut laser_x = LAMAR_PROJECTILE_X;
        let mut hit = false;
        while laser_x < 640 {
            self.laser_end_x = laser_x;
            let horizontal_hit = laser_x >= enemy_x && laser_x <= enemy_x + 6;
            let relative_y = self.laser_y - self.enemy_y;
            let vertical_hit = relative_y > 1 && relative_y < 150;
            if horizontal_hit && vertical_hit {
                hit = true;
                break;
            }
            laser_x += 8;
        }

        if hit {
            self.enemy_offset = 0;
            self.enemy_y = self.random_enemy_y();
            self.kills += 1;
            if self.difficulty == 2 {
                self.boost += 5;
            }
            // A laser kill did not reroll projectile probability or reset the
            // enemy projectile offset in Game.java.
        }
    }

    fn after_render(&mut self) {
        self.laser_visible = false;
    }

    fn toggle_pause(&mut self) {
        self.state = match self.state {
            STATE_PLAYING => STATE_PAUSED,
            STATE_PAUSED => STATE_PLAYING,
            other => other,
        };
    }

    fn legacy_retry(&mut self) {
        if self.state != STATE_DEAD {
            return;
        }
        // The original retry always restored 200 HP and kept kills, boost,
        // enemy position, projectile roll, and offsets intact.
        self.health = 200;
        self.player_y = 0;
        self.state = STATE_PLAYING;
        self.laser_visible = false;
    }
}

static mut GAME: Game = Game::new();

fn game_mut() -> &'static mut Game {
    unsafe { &mut *(&raw mut GAME) }
}

fn game_ref() -> &'static Game {
    unsafe { &*(&raw const GAME) }
}

#[no_mangle]
pub extern "C" fn lamar_version() -> u32 {
    2
}

#[no_mangle]
pub extern "C" fn lamar_reset(difficulty: u32, seed: u32) {
    game_mut().reset(difficulty, seed);
}

#[no_mangle]
pub extern "C" fn lamar_restart() {
    game_mut().legacy_retry();
}

#[no_mangle]
pub extern "C" fn lamar_update(dt: f32) {
    game_mut().update(dt);
}

#[no_mangle]
pub extern "C" fn lamar_nudge_player(direction: i32) {
    game_mut().nudge_player(direction);
}

#[no_mangle]
pub extern "C" fn lamar_register_input() {
    game_mut().register_input();
}

#[no_mangle]
pub extern "C" fn lamar_fire() {
    game_mut().fire();
}

#[no_mangle]
pub extern "C" fn lamar_after_render() {
    game_mut().after_render();
}

#[no_mangle]
pub extern "C" fn lamar_toggle_pause() {
    game_mut().toggle_pause();
}

#[no_mangle]
pub extern "C" fn lamar_state() -> u32 {
    game_ref().state
}

#[no_mangle]
pub extern "C" fn lamar_difficulty() -> u32 {
    game_ref().difficulty
}

#[no_mangle]
pub extern "C" fn lamar_player_y() -> i32 {
    game_ref().player_y
}

#[no_mangle]
pub extern "C" fn lamar_enemy_x() -> i32 {
    game_ref().enemy_x()
}

#[no_mangle]
pub extern "C" fn lamar_enemy_y() -> i32 {
    game_ref().enemy_y
}

#[no_mangle]
pub extern "C" fn lamar_health() -> i32 {
    game_ref().health
}

#[no_mangle]
pub extern "C" fn lamar_max_health() -> i32 {
    game_ref().max_health
}

#[no_mangle]
pub extern "C" fn lamar_boost() -> i32 {
    game_ref().boost
}

#[no_mangle]
pub extern "C" fn lamar_kills() -> i32 {
    game_ref().kills
}

#[no_mangle]
pub extern "C" fn lamar_laser_visible() -> u32 {
    game_ref().laser_visible as u32
}

#[no_mangle]
pub extern "C" fn lamar_laser_y() -> i32 {
    game_ref().laser_y
}

#[no_mangle]
pub extern "C" fn lamar_laser_end_x() -> i32 {
    game_ref().laser_end_x
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_active() -> u32 {
    game_ref().enemy_projectile_active as u32
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_x() -> i32 {
    game_ref().enemy_projectile_x
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_y() -> i32 {
    game_ref().enemy_projectile_y
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn difficulty_preserves_original_health_values() {
        let mut game = Game::new();
        game.reset(1, 1);
        assert_eq!(game.health, 400);
        game.reset(2, 1);
        assert_eq!(game.health, 200);
        game.reset(3, 1);
        assert_eq!(game.health, 100);
    }

    #[test]
    fn keypresses_move_fifteen_pixels_without_bounds() {
        let mut game = Game::new();
        game.reset(1, 1);
        for _ in 0..20 {
            game.nudge_player(1);
        }
        assert_eq!(game.player_y, 300);
        game.nudge_player(-1);
        assert_eq!(game.player_y, 285);
    }

    #[test]
    fn every_input_advances_the_goon_three_pixels() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.register_input();
        assert_eq!(game.enemy_offset, 3);
    }

    #[test]
    fn easy_legacy_ticks_move_four_pixels_each() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.projectile_roll = 3;
        game.update(0.050);
        assert_eq!(game.enemy_offset, 40);
    }

    #[test]
    fn passing_enemy_costs_twenty_health_and_rerolls() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.projectile_roll = 3;
        game.enemy_offset = 786;
        game.legacy_tick();
        assert_eq!(game.health, 380);
        assert_eq!(game.enemy_offset, 4);
    }

    #[test]
    fn laser_sweeps_instantly_and_uses_the_six_pixel_hit_window() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.player_y = 0;
        game.enemy_y = 100;
        game.enemy_offset = GOON_START_X - 403;
        game.fire();
        assert!(game.laser_visible);
        assert_eq!(game.laser_end_x, 403);
        assert_eq!(game.kills, 1);
        assert_eq!(game.enemy_offset, 0);
    }

    #[test]
    fn meh_boost_heals_at_exactly_twenty_five() {
        let mut game = Game::new();
        game.reset(2, 1);
        game.health = 100;
        game.boost = 25;
        game.legacy_tick();
        assert_eq!(game.health, 150);
        assert_eq!(game.boost, 0);
    }

    #[test]
    fn pause_freezes_legacy_ticks() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.toggle_pause();
        game.update(0.050);
        assert_eq!(game.state, STATE_PAUSED);
        assert_eq!(game.enemy_offset, 0);
    }

    #[test]
    fn retry_restores_two_hundred_and_keeps_legacy_state() {
        let mut game = Game::new();
        game.reset(3, 1);
        game.state = STATE_DEAD;
        game.kills = 7;
        game.boost = 10;
        game.enemy_offset = 321;
        game.legacy_retry();
        assert_eq!(game.health, 200);
        assert_eq!(game.player_y, 0);
        assert_eq!(game.kills, 7);
        assert_eq!(game.boost, 10);
        assert_eq!(game.enemy_offset, 321);
        assert_eq!(game.state, STATE_PLAYING);
    }

    #[test]
    fn enemy_projectile_hit_is_immediately_fatal() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.projectile_roll = 1;
        game.enemy_y = 100;
        game.enemy_offset = 420;
        game.enemy_projectile_offset = 10;
        game.legacy_tick();
        assert_eq!(game.state, STATE_DEAD);
    }
}
