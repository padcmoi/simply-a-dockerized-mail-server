require ["fileinto", "comparator-i;ascii-numeric","relational"];


# Evaluating the headers directly is always possible as long as the headers are actually added to the messages by the scanner software. For example, to file SpamAssassin-tagged mails into a folder called “Spam”:
if header :contains "X-Spam-Flag" "YES" {
    fileinto "Junk";
}

# The following example discards SpamAssassin-tagged mails with level higher than or equal to 10:
if header :contains "X-Spam-Level" "**********" {
    discard;
    stop;
}

# Some spam scanners only produce a numeric score in a header. Then, the test becomes more involved:
if allof (
    not header :matches "x-spam-score" "-*",
    header :value "ge" :comparator "i;ascii-numeric" "x-spam-score" "10" )
{
    discard;
    stop;
}