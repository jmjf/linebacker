use linebacker;

CREATE TABLE ClientAuthorization (
	ClientIdentifier varchar(256) NOT NULL UNIQUE CLUSTERED,
	ClientScopes varchar(1024) NOT NULL,
);