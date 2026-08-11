const STATE_PLAYING: u32 = 1;
const STATE_PAUSED: u32 = 2;
const STATE_DEAD: u32 = 3;

const INPUT_UP: u32 = 1;
const INPUT_DOWN: u32 = 2;
const MAX_BULLETS: usize = 8;

#[derive(Clone, Copy)]
struct Bullet {
    x: f32,
    y: f32,
    active: bool,
}

const EMPTY_BULLET: Bullet = Bullet {
    x: 0.0,
    y: 0.0,
    active: false,
};

struct Game {
    state: u32,
    difficulty: u32,
    input: u32,
    player_y: f32,
    enemy_x: f32,
    enemy_y: f32,
    health: i32,
    max_health: i32,
    boost: i32,
    kills: i32,
    player_bullets: [Bullet; MAX_BULLETS],
    enemy_bullet: Bullet,
    enemy_wave_shoots: bool,
    fire_cooldown: f32,
    hard_jitter_cooldown: f32,
    rng: u32,
}

impl Game {
    const fn new() -> Self {
        Self {
            state: STATE_PLAYING,
            difficulty: 1,
            input: 0,
            player_y: 0.0,
            enemy_x: 605.0,
            enemy_y: 166.0,
            health: 400,
            max_health: 400,
            boost: 0,
            kills: 0,
            player_bullets: [EMPTY_BULLET; MAX_BULLETS],
            enemy_bullet: EMPTY_BULLET,
            enemy_wave_shoots: false,
            fire_cooldown: 0.0,
            hard_jitter_cooldown: 0.0,
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
        self.input = 0;
        self.player_y = 0.0;
        self.enemy_x = 605.0;
        self.enemy_y = 166.0;
        self.boost = 0;
        self.kills = 0;
        self.player_bullets = [EMPTY_BULLET; MAX_BULLETS];
        self.enemy_bullet = EMPTY_BULLET;
        self.enemy_wave_shoots = false;
        self.fire_cooldown = 0.0;
        self.hard_jitter_cooldown = 0.0;
        self.rng = if seed == 0 { 0x4c41_4d41 } else { seed };
        self.respawn_enemy();
    }

    fn next_random(&mut self) -> u32 {
        let mut value = self.rng;
        value ^= value << 13;
        value ^= value >> 17;
        value ^= value << 5;
        self.rng = value;
        value
    }

    fn random_enemy_y(&mut self) -> f32 {
        (self.next_random() % 333) as f32
    }

    fn respawn_enemy(&mut self) {
        self.enemy_x = 605.0;
        self.enemy_y = self.random_enemy_y();
        let projectile_roll = (self.next_random() % 3) + 1;
        self.enemy_wave_shoots = match self.difficulty {
            1 => projectile_roll == 1,
            2 => projectile_roll <= 2,
            _ => true,
        };
        self.enemy_bullet = if self.enemy_wave_shoots {
            Bullet {
                x: self.enemy_x - 30.0,
                y: self.enemy_y + 75.0,
                active: true,
            }
        } else {
            EMPTY_BULLET
        };
    }

    fn enemy_speed(&self) -> f32 {
        match self.difficulty {
            1 => 240.0,
            2 => 120.0 + self.kills as f32 * 18.0,
            _ => 120.0 + self.kills as f32 * 22.0,
        }
    }

    fn enemy_bullet_speed(&self) -> f32 {
        if self.difficulty == 1 {
            60.0
        } else {
            120.0
        }
    }

    fn fire(&mut self) {
        if self.state != STATE_PLAYING || self.fire_cooldown > 0.0 {
            return;
        }

        if let Some(bullet) = self.player_bullets.iter_mut().find(|bullet| !bullet.active) {
            *bullet = Bullet {
                x: 227.0,
                y: self.player_y + 200.0,
                active: true,
            };
            self.fire_cooldown = 0.14;
        }
    }

    fn nudge_player(&mut self, direction: i32) {
        if self.state != STATE_PLAYING {
            return;
        }
        self.player_y = (self.player_y + 15.0 * direction.signum() as f32).clamp(-75.0, 225.0);
    }

    fn register_kill(&mut self) {
        self.kills += 1;
        if self.difficulty == 2 {
            self.boost += 5;
            if self.boost >= 25 {
                self.health += 50;
                self.boost = 0;
            }
        }
        self.respawn_enemy();
    }

    fn update(&mut self, dt: f32) {
        if self.state != STATE_PLAYING {
            return;
        }

        let dt = dt.clamp(0.0, 0.05);
        self.fire_cooldown = (self.fire_cooldown - dt).max(0.0);
        self.hard_jitter_cooldown -= dt;

        if self.input & INPUT_UP != 0 {
            self.player_y -= 210.0 * dt;
        }
        if self.input & INPUT_DOWN != 0 {
            self.player_y += 210.0 * dt;
        }
        self.player_y = self.player_y.clamp(-75.0, 225.0);

        self.enemy_x -= self.enemy_speed() * dt;
        if self.difficulty == 3 && self.hard_jitter_cooldown <= 0.0 {
            self.enemy_y = self.random_enemy_y();
            self.hard_jitter_cooldown = 0.08;
        }

        if self.enemy_x < -180.0 {
            self.health -= 20;
            if self.health <= 0 {
                self.state = STATE_DEAD;
                return;
            }
            self.respawn_enemy();
        }

        let mut enemy_was_hit = false;
        for bullet in &mut self.player_bullets {
            if !bullet.active {
                continue;
            }

            bullet.x += 500.0 * dt;
            let horizontal_hit =
                bullet.x + 60.0 >= self.enemy_x && bullet.x <= self.enemy_x + 200.0;
            let vertical_hit = bullet.y - self.enemy_y > 1.0 && bullet.y - self.enemy_y < 150.0;
            if horizontal_hit && vertical_hit {
                bullet.active = false;
                enemy_was_hit = true;
                break;
            }
            if bullet.x > 640.0 {
                bullet.active = false;
            }
        }

        if enemy_was_hit {
            self.register_kill();
        }

        if self.enemy_bullet.active {
            self.enemy_bullet.x -= self.enemy_bullet_speed() * dt;
            let horizontal_hit =
                self.enemy_bullet.x <= 145.0 && self.enemy_bullet.x + 50.0 >= -45.0;
            let relative_y = self.enemy_bullet.y - self.player_y;
            let vertical_hit = relative_y > 95.0 && relative_y < 255.0;
            if horizontal_hit && vertical_hit {
                self.enemy_bullet.active = false;
                self.state = STATE_DEAD;
            } else if self.enemy_bullet.x < -60.0 {
                self.enemy_bullet.active = false;
            }
        }
    }

    fn toggle_pause(&mut self) {
        self.state = match self.state {
            STATE_PLAYING => STATE_PAUSED,
            STATE_PAUSED => STATE_PLAYING,
            other => other,
        };
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
    1
}

#[no_mangle]
pub extern "C" fn lamar_reset(difficulty: u32, seed: u32) {
    game_mut().reset(difficulty, seed);
}

#[no_mangle]
pub extern "C" fn lamar_restart() {
    let game = game_mut();
    let difficulty = game.difficulty;
    let seed = game.next_random();
    game.reset(difficulty, seed);
}

#[no_mangle]
pub extern "C" fn lamar_update(dt: f32) {
    game_mut().update(dt);
}

#[no_mangle]
pub extern "C" fn lamar_set_input(input: u32) {
    game_mut().input = input & (INPUT_UP | INPUT_DOWN);
}

#[no_mangle]
pub extern "C" fn lamar_fire() {
    game_mut().fire();
}

#[no_mangle]
pub extern "C" fn lamar_nudge_player(direction: i32) {
    game_mut().nudge_player(direction);
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
pub extern "C" fn lamar_player_y() -> f32 {
    game_ref().player_y
}

#[no_mangle]
pub extern "C" fn lamar_enemy_x() -> f32 {
    game_ref().enemy_x
}

#[no_mangle]
pub extern "C" fn lamar_enemy_y() -> f32 {
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
pub extern "C" fn lamar_bullet_active(index: u32) -> u32 {
    game_ref()
        .player_bullets
        .get(index as usize)
        .map_or(0, |bullet| bullet.active as u32)
}

#[no_mangle]
pub extern "C" fn lamar_bullet_x(index: u32) -> f32 {
    game_ref()
        .player_bullets
        .get(index as usize)
        .map_or(0.0, |bullet| bullet.x)
}

#[no_mangle]
pub extern "C" fn lamar_bullet_y(index: u32) -> f32 {
    game_ref()
        .player_bullets
        .get(index as usize)
        .map_or(0.0, |bullet| bullet.y)
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_active() -> u32 {
    game_ref().enemy_bullet.active as u32
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_x() -> f32 {
    game_ref().enemy_bullet.x
}

#[no_mangle]
pub extern "C" fn lamar_enemy_bullet_y() -> f32 {
    game_ref().enemy_bullet.y
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
    fn passing_enemy_costs_twenty_health() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.enemy_x = -181.0;
        game.update(0.016);
        assert_eq!(game.health, 380);
        assert_eq!(game.enemy_x, 605.0);
    }

    #[test]
    fn meh_boost_heals_after_five_kills() {
        let mut game = Game::new();
        game.reset(2, 1);
        game.health = 100;
        for _ in 0..5 {
            game.register_kill();
        }
        assert_eq!(game.kills, 5);
        assert_eq!(game.boost, 0);
        assert_eq!(game.health, 150);
    }

    #[test]
    fn pause_freezes_the_game() {
        let mut game = Game::new();
        game.reset(1, 1);
        let enemy_x = game.enemy_x;
        game.toggle_pause();
        game.update(0.05);
        assert_eq!(game.state, STATE_PAUSED);
        assert_eq!(game.enemy_x, enemy_x);
    }

    #[test]
    fn quick_taps_keep_the_original_fifteen_pixel_step() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.nudge_player(1);
        assert_eq!(game.player_y, 15.0);
        game.nudge_player(-1);
        assert_eq!(game.player_y, 0.0);
    }

    #[test]
    fn enemy_projectile_hit_is_fatal_like_the_java_game() {
        let mut game = Game::new();
        game.reset(1, 1);
        game.enemy_bullet = Bullet {
            x: 145.0,
            y: 150.0,
            active: true,
        };
        game.update(0.0);
        assert_eq!(game.state, STATE_DEAD);
    }
}
