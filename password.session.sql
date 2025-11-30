create tables if not exists users (
    id int auto_increment primary key,
    username varchar(50) not null unique,
    email varchar(100) not null unique,
);

INSERT INTO users (name, email) values
    ( 'alice', 'alice2hgamil.com'),
    ( 'bob', 'bob2hgamail.com'),
    ( 'charlie', 'charlie2hgamail.com');

select * from users;



