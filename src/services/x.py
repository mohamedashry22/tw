import os

# Define the root directory to search for Java files
root_dir = "/Users/mohamed.ashry1/Daas-dev/dls-tmf-backend/src/main/java/com/vodafone/dls/tmfbackend"

# Define the path of the output file
output_file = "/Users/mohamed.ashry1/combined_code.java"

# Open the output file in write mode
with open(output_file, "w") as outfile:
    # Walk through the directory and its subdirectories
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            # Process only .java files
            if file.endswith(".java"):
                file_path = os.path.join(subdir, file)
                
                # Write a header to indicate the file being included
                outfile.write(f"\n\n// ====== Start of {file_path} ======\n")
                
                # Read the content of the Java file and write it to the output file
                with open(file_path, "r") as infile:
                    outfile.write(infile.read())
                
                # Write a footer to separate files
                outfile.write(f"\n// ====== End of {file_path} ======\n")

print(f"All Java files have been combined into {output_file}")