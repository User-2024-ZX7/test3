use my_db;

create table users (
    id int auto_increment primary key,
    name varchar(80),
    email varchar(120) unique,
    password varchar(255),
    role varchar(20) default 'user'
);

create table my_db.data
select * from users;

