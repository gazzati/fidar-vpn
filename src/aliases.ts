import moduleAlias from "module-alias"

moduleAlias.addAliases({
  "@root": `${__dirname}/`,
  "@database": `${__dirname}/database/`,
  "@interfaces": `${__dirname}/interfaces/`,
  "@api": `${__dirname}/api/`,
  "@helpers": `${__dirname}/helpers/`,
  "@services": `${__dirname}/services/`
})
