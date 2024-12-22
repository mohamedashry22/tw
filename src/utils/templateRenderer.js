import Handlebars from 'handlebars';

export function renderTemplate(templateContent, data) {
  const template = Handlebars.compile(templateContent);
  return template(data);
}