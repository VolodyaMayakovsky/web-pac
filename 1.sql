-- Таблица пользователей (расширяем существующую или создаём новую)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    role VARCHAR(50) DEFAULT 'student', -- 'student' или 'teacher'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расписания (занятия)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,          -- название предмета/занятия
    description TEXT,
    lesson_type VARCHAR(50),               -- лекция, семинар, лабораторная и т.д.
    day_of_week INTEGER,                  -- 1=пн, 2=вт, ..., 7=вс
    start_time TIME,
    end_time TIME,
    location VARCHAR(255),                -- аудитория / ссылка
    teacher_name VARCHAR(255),            -- можно хранить имя преподавателя
    group_name VARCHAR(100),              -- группа студентов
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заданий
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,    -- название курса / предмета
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- преподаватель
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- для кого задание (если индивидуальное)
    group_name VARCHAR(100),              -- или для группы
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица прогресса (можно вычислять на лету, но для простоты сохраняем агрегаты)
CREATE TABLE IF NOT EXISTS progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    percent_complete DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_name)
);

-- Индексы для производительности
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_day_of_week ON schedules(day_of_week);
CREATE INDEX idx_tasks_student_id ON tasks(student_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_progress_student_id ON progress(student_id);